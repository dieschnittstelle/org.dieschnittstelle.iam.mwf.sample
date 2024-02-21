/**
 * Created by master on 05.02.16.
 *
 * on create(), we need to check whether we have any bidirectionaly dependencies. In case we have, we must first create a shallow version of the entity obtaining the id and then execute an update!
 *
 * TODO: Entity.prePersist() should be run asynchronously in order to be used for media content processing
 * TODO: allow to clone an entity in order to support edit/undo actions at UI level
 * TODO: allow for more efficient handling of entity references by allowing crud implementations to implement add/removeReference(fromType,fromId,fromAttr,toType,toId,bidir) and only using the current solution if the function is not implemented (currently: adding/removing references requires that both parts of an association are completely loaded as references are persisted as arrays on the objects)
 */
/*jslint nomen: true*/
import {mwfUtils} from "../../framework-modules.js";
import {eventhandling} from "../../framework-modules.js";

console.log("loading module...");

var allManagedAttributes = new Map();

var typenameAttr = "@typename";

function EntityManager() {

    // TODO: rather than using single maps, at least parts of them could be consolidated at some moment...
    // a map of crud operations implementations for each entity type
    var crudops = {};

    // provide entity type definitions
    var entityTypedefs = {};

    // a map of entities, containing a map for each entity type
    var entities = {};

    // for more efficient access a map of arrays pointing to the same entities
    var entityarrays = {};

    // a map that specifies for which type the event dispatcher shall be used - for the time being, we only support complete dispatching of all write operations in contrast to not dispatching read operations
    var entityCRUDDispatching = {};

    var initialised = false;

    // add crudoperations for the given type and an optional type definition - complaints related to "unused definition" do not count as the function will be used by concrete applications based on mwf
    this.addCRUD = function (entitytype, entitycrudops, typedef, dispatch) {
        console.log("addCRUD(): " + entitytype);
        crudops[entitytype] = entitycrudops;
        entities[entitytype] = {};
        // we set an attribute on the map that marks whether readAll has already been executed
        entityarrays[entitytype] = {
            values: [],
            syncedWithDatasource: false
        };
        if (typedef) {
            console.log("addCRUD(): will use specific entity typedef");
            entityTypedefs[entitytype] = typedef;
        }
        entityCRUDDispatching[entitytype] = dispatch;
    };

    // reset the crud operations, resulting in clearing the internally represented entities
    this.resetCRUD = function (entitytype, entitycrudops) {
        console.log("resetCRUD(): " + entitytype);
        crudops[entitytype] = entitycrudops;
        entities[entitytype] = {};
        // we set an attribute on the map that marks whether readAll has already been executed
        entityarrays[entitytype] = {
            values: [],
            syncedWithDatasource: false
        };
    };

    // allow to access crudops
    this.getCRUD = function (entitytype) {
        return crudops[entitytype];
    };

    this.addTypedef = function (typedef, typename) {
        if (typedef.prototype.getTypename) {
            entityTypedefs[typedef.prototype.getTypename()] = typedef;
        } else if (!typename) {
            console.error("inconsistent datamodel. Got typedef which does not seem to be an entity type, and no typename is specified: " + typedef);
        } else {
            console.log("adding typedef for non-entity type: " + typename);
            entityTypedefs[typename] = typedef;
        }
    };

    this.initialise = function () {
        // try out to process the managed attributes here
        if (!initialised) {
            console.log("EntityManager has not yet been initialised. Run and add managedAttributes", allManagedAttributes);
            // TODO: the forllowing foreach functions should be looked at
            allManagedAttributes.forEach(function (attrs, type) {
                attrs.forEach(function (params, attr) {
                    type.prototype.addManagedAttributeToType(type, attr, params.attrtypename, params);
                });
            });
            initialised = true;
        } else {
            console.warn("EntityManager has already been initialised! This function should only called once!");
        }
    };

    /*
     * check whether the em has been initialised
     */
    function checkInitialised() {
        if (!initialised) {
            console.error("EntityManager has not been initialised yet! It is very likely that the application will not work!");
        }
    }

    /*
     * check whether crudops are specified for some entitytype
     */
    function checkCrudops(entitytype) {
        if (!crudops[entitytype]) {
            var msg = "Cannot run crudops for entitytype " + entitytype + ". No crudops registered so far. Crudops are: " + JSON.stringify(crudops);
            console.error(msg);
            throw new Error(msg);
        }
    }

    function pojoToEntity(pojo, callback, useEntity) {
        console.log("pojoToEntity()");
        // check whether we have a typename attribute
        var typename = pojo[typenameAttr];
        console.log("pojoToEntity(): typename (from attr " + typenameAttr + "): " + typename);
        var entity;
        if (typename) {
            console.log("pojoToEntity(): useEntity: ", useEntity);
            // this allows us to preserve referential identity of objects before and after creation!!!
            if (useEntity) {
                entity = useEntity;
            }
            else {
                console.log("pojoToEntity(): create new entity from typedef: " + typename);
                entity = new entityTypedefs[typename]();
            }
            // check whether we have an instance of an entity
            if (entity instanceof Entity) {
                console.log("pojoToEntity(): type of pojo is an entity type: " + typename + ". Call fromPojo(), then postLoad(). Entity is: ", entity);
                entity.fromPojo(pojo);

                // we add the entity to the local representation befor calling postLoad -> this way we should omit recursion in case of bidirectional assocs
                if (!entities[typename][entity._id]) {
                    console.log("++++++ adding entity with id " + entity._id + " to managed entities of type " + typename);
                    entities[typename][entity._id] = entity;
                    entityarrays[typename].values.push(entity);
                }

                entity.postLoad(function () {
                    // here we check whether an entity of the given id already exists
                    var existingEntity = entities[typename][entity._id];
                    if (existingEntity) {
                        console.log("pojoToEntity(): entity " + entity._id + "@" + typename + " already exists. Merge output of fromPojo().postLoad() into the entity");
                        var attr;
                        for (attr in entity) {
                            existingEntity[attr] = entity[attr];
                        }
                        callback(existingEntity);
                    }
                    else {
                        callback(entity);
                    }
                });
            }
            else {
                console.log("pojoToEntity(): type of pojo is not an entity type: " + typename + ". Just copy attributes of pojo to instance.");
                var attr;
                for (attr in pojo) {
                    entity[attr] = pojo[attr];
                }
                callback(entity);
            }
        }
        else {
            console.log("pojoToEntity(): no typename specified. Just return pojo.");
            entity = pojo;
            callback(entity);
        }
    }

    /*
     * notify about the result of a crud operation by using the eventdispatcher and/or calling a callback
     */
    function notify(entitytype, eventtype, result, callback) {
        if (entityCRUDDispatching[entitytype] && eventtype != "read" && eventtype != "readAll") {
            console.log("notify(): will dispatch crud event " + eventtype + "@" + entitytype);
            eventhandling.notifyListeners(new eventhandling.Event("crud", eventtype, entitytype, result));
        }
        if (callback) {
            console.log("notify(): done dispatching crud event " + eventtype + "@" + entitytype + ". Now invoking callback.");
            callback(result);
        }
        else {
            console.log("notify(): done dispatching crud event " + eventtype + "@" + entitytype + ". No further callback specified.");
        }
    }

    /*
     * remoce an entity from map and array
     */
    function removeEntity(entitytype, entityid) {
        var entity = entities[entitytype][entityid];
        if (!entity) {
            console.warn("removeEntity(): no entity seems to exist for type " + entitytype + " and id: " + entityid);
        }
        else {
            delete entities[entitytype][entityid];
            var array = entityarrays[entitytype].values;
            // this is not unrisky in case some reference will be broken
            array.splice(array.indexOf(entity), 1);
        }
    }

    // function map2array(map) {
    //     var values = [];
    //     var key;
    //     for (key in map) {
    //         values.push(map[key]);
    //     }
    //     return values;
    // }

    /*
     * merge some update into a base - note that merge is incremental and does not remove non existing attributes!
     */
    function mergeEntity(base, update) {
        var key;
        for (key in update) {
            base[key] = update[key];
        }
    }

    /*
     * this implementation is kindof clumpsy... note that in most cases it will only be called once for each entitytype, though...
     */
    function syncWithDatasource(entitytype, callback) {
        crudops[entitytype].readAll(function (read) {
            console.log("readAll(): read entities of type " + entitytype + ": " + read.length);

            // we distinguish the case where we have postLoad vs not postLoad functions declared
            if (entityTypedefs[entitytype].prototype instanceof Entity) {
                console.log("syncWithDatasource(): process datasource output as entity instances...");

                if (Object.keys(read).length > 0) {

                    var recurse = true;

                    if (recurse) {

                        // if we have fast i/o response from datasource, recursion is by far more efficient than iteration as in each step of the recursion the async callback might provide data that might be used at some further step!
                        // BUT: if response is delayed, delays will add up!!!
                        function runOnNext(count, total) {
                            var currentObj = total[count];
                            console.log("syncWithDatasource(): currentObj: " + mwfUtils.stringify(currentObj));
                            // as a side-effect, pojoToEntity will call postLoad and add the entity to the local entities of the given type!
                            pojoToEntity(currentObj, function () {
                                count++;
                                if (count == total.length) {
                                    entityarrays[entitytype].syncedWithDatasource = true;
                                    console.log("syncWithDatasource(): postLoad has been executed for all read entities");
                                    callback(entityarrays[entitytype].values);
                                }
                                else {
                                    runOnNext(count++, total);
                                }
                            }.bind(this));
                        }

                        runOnNext(0, read);
                    }
                    else {
                        var countdown = read.length;
                        var i, currentObj;
                        for (i = 0; i < read.length; i++) {
                            currentObj = read[i];
                            console.log("syncWithDatasource(): currentObj: " + mwfUtils.stringify(currentObj));
                            // as a side-effect, pojoToEntity will call postLoad and add the entity to the local entities of the given type!
                            pojoToEntity(currentObj, function () {
                                countdown--;
                                if (countdown == 0) {
                                    entityarrays[entitytype].syncedWithDatasource = true;
                                    console.log("syncWithDatasource(): postLoad has been executed for all read entities");
                                    callback(entityarrays[entitytype].values);
                                }
                            }.bind(this));
                        }
                    }
                }
                else {
                    // do not forget this callback...
                    callback([]);
                }
            }
            else {
                console.log("syncWithDatasource(): datasource output does not contain entity instances...");
                callback(read);
            }


        }.bind(this));

    }

    this.create = function (entitytype, entity, callback) {
        console.log("create(): ", entity);
        checkInitialised();
        checkCrudops(entitytype);
        // we delete any existing local id
        delete entity._id;
        // first of all, we remove the managedAttributes property
        // #ES6: not required anymore, managed attributes declarations are stored in prototype
        // delete entity.managedAttributes;
        // /ES6

        entity.prePersist();

        var tobecreated = entity;

        // we convert the entity to a pojo
        if (entity instanceof Entity) {
            tobecreated = entity.toPojo();
        }
        // call create on crudops, then store the entity
        crudops[entitytype].create(tobecreated, function (created) {
            // this inserts the attributes of the createdEntity into the original one
            entity.clear();
            pojoToEntity(created, function (createdEntity) {
                notify(entitytype, "created", createdEntity, callback);
            }.bind(this), entity);
        }.bind(this));
    };


    // this wil be called on two different occasions below (we moved it outside of update() as it is also used in refresh())
    function mergeUpdate(entitytype, entityid, update) {
        // we will add the update attributes to our local copy of the entity
        var currentEntity = entities[entitytype][entityid];

        console.log("mergeUpdate(): existing: " + mwfUtils.stringify(currentEntity.toPojo()));
        console.log("mergeUpdate(): update: " + mwfUtils.stringify(update.toPojo()));

        if (!currentEntity) {
            console.error("update(): cannot be carried out for entity of type " + entitytype + " and id: " + entityid + ". Entity is unknown to EntityManager!");
            return update;
        }
        else {
            // ignore the complaints regarding "probably missing hasOwnProperty check" for the time being
            var key, value;
            for (key in update) {
                value = update[key];
                // we must not override the id!!! ... and we should not override keys with null values!
                // TODO: there should be some solution to deal with deletion/resetting of values
                if (value && key != "_id") {
                    currentEntity[key] = value;
                }
            }
        }
        console.log("mergeUpdate(): merged: " + mwfUtils.stringify(currentEntity.toPojo()));
        return currentEntity;
    }


    this.update = function (entitytype, entityid, update, callback, noentity) {
        checkInitialised();
        checkCrudops(entitytype);

        var tobeupdated = update;

        // convert an entity to a pojo
        if (update instanceof Entity) {
            update.prePersist();
            tobeupdated = update.toPojo();
        }
        // if we have an entity type, but a partial update, create a new instance, take over the attributes and call toPojo()
        else if (entityTypedefs[entitytype] && !noentity) {

            tobeupdated = new entityTypedefs[entitytype]();
            var attr;
            for (attr in update) {
                tobeupdated[attr] = update[attr];
                // create a pojo
                tobeupdated = tobeupdated.toPojo();
            }
        }
        else {
            console.log("update(): update shall not be converted to an entity, just execute it...");
            tobeupdated = update;
        }

        crudops[entitytype].update(entityid, tobeupdated, function (updated) {
            if (updated) {
                // once the update is done, we instantiate a new entity of the given type, run fromPojo() and merge the result with the existing entity
                var updatedAttrs;
                if (entityTypedefs[entitytype]) {
                    updatedAttrs = new entityTypedefs[entitytype]();
                    updatedAttrs.fromPojo(tobeupdated);
                    updatedAttrs.postLoad(function () {
                        var updatedEntity = mergeUpdate(entitytype, entityid, updatedAttrs);
                        notify(entitytype, "updated", updatedEntity, callback);
                    });
                }
                else {
                    updatedAttrs = tobeupdated;
                    // we add the id
                    updatedAttrs._id = entityid;
                    notify(entitytype, "updated", updatedAttrs, callback);
                }
            }
            else {
                console.warn("update(): crudop failed for entity of type " + entitytype + " and id: " + entityid);
                if (callback) {
                    callback(null);
                }

            }
        }.bind(this));
    };

    this.refresh = function (entitytype, entityid, callback, noentity) {
        checkInitialised();
        checkCrudops(entitytype);

        crudops[entitytype].read(entityid, function (refreshed) {
            if (refreshed) {
                // once the read is done, we instantiate a new entity of the given type, run fromPojo() and merge the result with the existing entity
                var refreshedAttrs;
                if (entityTypedefs[entitytype]) {
                    refreshedAttrs = new entityTypedefs[entitytype]();
                    refreshedAttrs.fromPojo(refreshed);
                    refreshedAttrs.postLoad(function () {
                        var refreshedEntity = mergeUpdate(entitytype, entityid, refreshedAttrs);
                        notify(entitytype, "refreshed", refreshedEntity, callback);
                    });
                }
                else {
                    refreshedAttrs = refreshed;
                    // we add the id
                    refreshedAttrs._id = entityid;
                    notify(entitytype, "refreshed", refreshedAttrs, callback);
                }
            }
            else {
                console.warn("refresh(): crudop failed for entity of type " + entitytype + " and id: " + entityid);
                if (callback) {
                    callback(null);
                }

            }
        }.bind(this));
    };

    this.delete = function (entitytype, entityid, callback) {
        checkInitialised();
        checkCrudops(entitytype);
        crudops[entitytype].delete(entityid, function (deleted) {
            if (deleted) {
                removeEntity(entitytype, entityid);
                notify(entitytype, "deleted", entityid);
                if (callback) {
                    callback(entityid);
                }
            }
            else {
                console.warn("delete(): crudop failed for entity of type " + entitytype + " and id: " + entityid);
                if (callback) {
                    callback(-1);
                }
            }
        });
    };

    this.read = function (entitytype, entityid, callback) {
        checkInitialised();
        checkCrudops(entitytype);
        // read will first be executed on the local map. if entity is not found, it will be lookedup using crudops
        var entity = entities[entitytype][entityid];
        if (entity) {
            console.log("read(): read entity of type " + entitytype + " and id " + entityid + " from managed entities");
            callback(entity);
        }
        else {
            console.log("********* read(): entity of type " + entitytype + " and id " + entityid + " is not contained in managed entities. Call read() crudop on datasource");
            console.log("managed entities of type " + entitytype + ": " + Object.keys(entities[entitytype]));
            crudops[entitytype].read(entityid, function (read) {
                console.log("######## read(): read entity from crudops: " + mwfUtils.stringify(read));
                // it might be ok if the entity does not exist yet!
                if (read) {
                    pojoToEntity(read, function (readEntity) {
                        notify(entitytype, "read", readEntity, callback);
                    });
                }
                else {
                    if (callback) {
                        callback(null);
                    }
                }
            }.bind(this));
        }
    };

    // we only read out once!
    this.readAll = function (entitytype, callback) {
        checkInitialised();
        checkCrudops(entitytype);
        if (entityarrays[entitytype].syncedWithDatasource) {
            console.log("readAll(): entities of type " + entitytype + " have already been synced. Return " + entityarrays[entitytype].values.length + " managed entities without accessing datasource");
            // we should represent the entities both as map and as list for more efficient access
            callback(entityarrays[entitytype].values);
        }
        else {
            console.log("readAll(): entities of type " + entitytype + " have not yet been synced. Call crudop on datasource");
            syncWithDatasource.call(this, entitytype, callback);
        }
    };

    this.getCrudopsForType = function (entitytype) {
        return crudops[entitytype];
    };

    // if some specific implementation used crud operartions beyond the standard ones, it might be necessary to refresh the entity manager's representation of affected entities
    this.syncLocal = function (entitytype, entity) {
        checkInitialised();
        checkCrudops(entitytype);
        var existing = entities[entitytype][entity._id];
        if (existing) {
            mergeEntity(existing, entity);
        }
        else {
            entities[entitytype][entity._id] = entity;
            entityarrays[entitytype].values.push(entity);
        }
    };

    this.resetEntities = function (entitytype) {
        console.warn("resetEnties(): will remove all local entities of type " + entitytype + ". Entities will be read out from datasource on subsequent access...");
        entities[entitytype] = {};
        entityarrays[entitytype] = {};
        entityarrays[entitytype].values = [];
    };

    this.sync = function (entitytype, entityid, callback) {
        checkInitialised();
        checkCrudops(entitytype);
        crudops[entitytype].read(entityid, function (read) {
            if (!read) {
                console.warn("sync(): read for entity of type " + entitytype + " and id " + entityid + ". It does not seem to be contained in the datasource! Add it locally anyway...");
            }
            this.syncLocal(entitytype, read);
            callback(read);
        }.bind(this));
    };

    this.syncAll = function (entitytype, callback) {
        checkInitialised();
        checkCrudops(entitytype);
        syncWithDatasource.call(this, entitytype, callback);
    };

    this.newInstanceOfType = function (entitytype) {
        checkInitialised();
        return new entityTypedefs[entitytype]();
    };

    this.getManagedAttributeParams = function (typename, attrname) {
        var typedef = entityTypedefs[typename];
        if (!typedef) {
            console.error("inconsistent datamodel. Could not find typedef for type: " + typename);
        }
        else {
            var attrs = allManagedAttributes.get(typedef);
            if (!attrs) {
                console.error("inconsistent datamodel. Could not find any managed attributes for type: " + typename);
            }
            else {
                var attr = attrs.get(attrname);
                if (!attr) {
                    console.error("inconsistent datamodel. Could not find managed attribute " + attrname + " for type: " + typename);
                }
                else {
                    return attr;
                }
            }
        }
    };

}

// /*
//  * this is a utility function: create an entity instance from an object in the object store
//  */
// function createEntityInstanceFromObject(entitytypedef, object) {
//
//     var entity = new entitytypedef();
//     var attr;
//     for (attr in object) {
//         entity[attr] = object[attr];
//     }
//
//     delete entity.managedAttributes;
//
//     return entity;
// }

/*
 * create a new instance of the entitymanager which will be used by the entity implementation
 */
var em = new EntityManager();


/*
 * entitytype: the type of entity
 * lazyload: whether the entity shall be loaded on access or lazily
 * inboundAttr: the attribute on the side of the given entity type that points to this entity
 * inboundAttrMul: whether the attribute has 0..* multiplicity
 *
 * TODO: here we also need to impement inverse adding/removal
 */
function ManagedEntity(params) {

    // TODO: make invisible and only accessible via getter
    this.loaded = false;

    // the two possible representations of the entity: as id / as object
    var entityid;
    var entityobj;

    this.getId = function () {
        return entityid;
    };

    this.entity = function () {
        console.log("entity()");
        return entityobj;
    };

    /*
     * the second parameter indicates that a lazily loaded attributes shall finally be loaded
     */
    this.load = function (callback, becomeEager) {
        if (params.lazyload && !becomeEager) {
            console.log(params.type + ".load(): entity shall be loaded lazily. Wait until loading will be enforced.");
            callback();
        }
        else {
            if (becomeEager) {
                console.log(params.type + ".load(): loading will be enforced for lazily loaded entities.");
            }
            this.entityobj = null;
            console.log(params.type + ".load(): about to load: " + entityid);
            em.read(params.type, entityid, function (read) {
                entityobj = read;
                this.loaded = true;
                callback(read);
            }.bind(this));
            // the previous bind() had been forgotten, and it *is* necessary here
        }
    };

    this.set = function (obj) {
        console.log("set(): " + obj);
        entityobj = obj;
        entityid = obj._id;
    };

    this.setEntityref = function (objid) {
        console.log("setEntityref(): " + objid);
        entityid = objid;
    };

}

mwfUtils.xtends(ManagedEntity, Object);

function createEntityId(entity) {
    if (entity && entity.getTypename) {
        return entity._id + "@" + entity.getTypename();
    }
    else {
        console.error("createEntityId(): object passed is not an entity: " + mwfUtils.stringify(entity));
    }
}

function segmentId(id) {
    var segments = id.split("@");
    return {id: (isNaN(segments[0]) ? segments[0] : parseInt(segments[0], 10)), typename: segments[1]};
}

/*
 * same arguments as managedEntity
 */
function ManagedEntitiesArray(params) {

    // var proto = ManagedEntitiesArray.prototype;

    // the two possible representations of the entity: as ids / as object
    var entityids = [];
    var entityobjs = [];

    // two arrays that track pending crud operations with regard to the attribute's owner on the associated entities
    this.pendingInverseAdditions = [];
    this.pendingInverseRemovals = [];

    // the ids onload (were meant to distinguish between original state and edited state, but is badly handleable)
    //this.entityidsOnload;

    var loaded = false;

    function addPendingInverse(entity) {
        if (params.inverse) {
            // this reference is ok as the function will be invoked using call() and passing the reference - holds for all other references further below
            if (this.pendingInverseAdditions.indexOf(entity) < 0) {
                this.pendingInverseAdditions.push(entity);
            }
            var index = this.pendingInverseRemovals.indexOf(entity);
            if (index > -1) {
                this.pendingInverseRemovals.splice(index, 1);
            }
        }
    }

    function removePendingInverse(entity) {
        if (params.inverse) {
            if (this.pendingInverseRemovals.indexOf(entity) < 0) {
                this.pendingInverseRemovals.push(entity);
            }
            var index = this.pendingInverseAdditions.indexOf(entity);
            if (index > -1) {
                this.pendingInverseAdditions.splice(index, 1);
            }
        }
    }

    // in order to account for polymorphy, we need to encode the type of entity in the id...
    function createId(entity) {
        return createEntityId(entity);
    }

    function lookupEntitypos(obj) {
        var i;
        for (i = 0; i < entityobjs.length; i++) {
            if (entityobjs[i]._id == obj._id) {
                return i;
            }
        }
        return -1;
    }

    function lookupEntityposForId(objid) {
        var i;
        for (i = 0; i < entityobjs.length; i++) {
            if (entityobjs[i]._id == objid) {
                return i;
            }
        }
        return -1;
    }

    function checkConsistency() {
        if (entityids.length != entityobjs.length) {
            console.error(params.attrname + ": inconsistent state of entity: ids vs. objs arrays differ in " + (loaded ? " LOADED " : " UNLOADED ") + " state: " + entityids + " vs." + entityobjs);
        }
    }

    this.getIds = function () {
        checkConsistency();
        // if we are loaded return the ids of the objects in entityobjs
        if (loaded) {
            var ids = [];
            entityobjs.forEach(function (obj) {
                ids.push(createId(obj));
            });
            return ids;
        }
        return entityids;
    };

    this.getNonTransientIds = function () {
        checkConsistency();
        var ids = [];
        this.getIds().forEach(function (id) {
            if (segmentId(id).id > 0) {
                ids.push(id);
            }
            else {
                console.log(params.attrname + ".getNonTransientIds(): ignore transient id: " + id);
            }
        });
        return ids;
    };

    this.entities = function () {
        console.log(params.attrname + ".entities().length " + entityobjs.length);
        checkConsistency();
        var objs = [];
        if (!loaded) {
            if (entityobjs.length > 0 && entityobjs[0] instanceof Entity) {
                // this is the case if we access entities of an object that is about to be created!
                console.info(params.attrname + ".entities(): managed attribute has not yet been loaded, but entities exist. Will return them");
                objs = objs.concat(entityobjs);
            }
            else {
                console.info(params.attrname + ".entities(): managed attribute has not yet been loaded. Will return empty array of objects!");
            }
        }
        else {
            objs = objs.concat(entityobjs);
        }
        if (params.lazyload) {
            // we append the load function to the array
            objs.load = function (callback) {
                console.log(params.attrname + ": will enforce loading lazily loaded entities...");
                this.load(callback, true);
            }.bind(this);
        }
        // make transparent whether we are loaded or not
        objs.loaded = loaded;

        return objs;
    };

    this.load = function (callback, becomeEager) {
        checkConsistency();
        //this.entityidsOnload = new Array();
        //this.entityidsOnload = this.entityidsOnload.concat(entityids);

        if (params.lazyload && !becomeEager) {
            console.log(params.type + ".load(): entities shall be loaded lazily. Wait until loading will be enforced.");
            callback([]);
        }
        else {
            // if both arrays are empty, we return immediately
            if (!loaded && entityids.length == 0) {
                console.log(params.type + ".load(): no entity references seem to exist");
                loaded = true;
                callback(entityobjs);
            }
            else if (loaded) {
                console.log(params.type + ".load(): already loaded.");
                callback(entityobjs);
            }
            else {
                // reset
                entityobjs.length = 0;

                console.log(params.type + ".load(): about to load: " + entityids);
                var countdown = entityids.length;
                var i, currentId;
                for (i = 0; i < entityids.length; i++) {
                    // here, we need to segment the id
                    currentId = segmentId(entityids[i]);
                    em.read(currentId.typename, currentId.id, function (read) {
                        entityobjs.push(read);
                        countdown--;
                        if (countdown == 0) {
                            console.log(params.type + ".load(): done loading.");
                            loaded = true;
                            callback(entityobjs);
                        }
                    });
                }
            }
        }
    };

    // this function is used by the fromPojo function of entity which will be called once a detached entity instance is obtained from the datasource
    this.pushEntityref = function (entityid) {
        checkConsistency(this);
        console.log(params.attrname + ".pushEntityref(): " + entityid);
        if (!loaded) {
            if (entityids.indexOf(entityid) == -1) {
                entityids.push(entityid);
                // try out with adding a dummy object to the array that takes the id. load() will result in these objects being replaced by the actual entities
                entityobjs.push({_id: entityid});
            }
            else {
                console.log("ManagedEntitiesArray.pushEntityref(): will not add id " + entityid + " to entities. It seems to be contained already.");
            }
        }
        else {
            console.warn("ManagedEntitiesArray.pushEntityref(): this function should not be called after loading! Ignore for managed attribute " + params.attrname);
        }
    };

    // we need to push the entity regardless of whether we are loaded or not
    this.push = function (entity) {
        checkConsistency();
        console.log(params.attrname + ".push(): " + entity + " with id: " + entity._id);
        // push does not distinguish between loaded and not loaded
        if (entityobjs.indexOf(entity) == -1) {
            entityobjs.push(entity);
            entityids.push(createId(entity));
            addPendingInverse.call(this, entity);
        }
        else {
            console.log("ManagedEntitiesArray.push(): will not add entity with id " + entity._id + " to entities. It seems to be contained already.");
        }
    };

    // access some object with a given id
    this.getObj = function (objid) {
        checkConsistency();
        console.log("getObj(): " + objid);

        if (!loaded) {
            console.warn("getObj() should only be called after loading!");
        }
        else {
            var index = lookupEntityposForId(objid);
            if (index < 0) {
                console.warn("getObj(): object with id " + objid + " could not be found!");
            }
            else {
                return entityobjs[index];
            }
        }
    };

    // remove some object with a given id
    this.removeObj = function (obj) {
        checkConsistency();
        console.log(params.attrname + ".removeObj(): " + obj);
        if (typeof obj != "object") {
            console.error("removeObj() should be passed an object. Ignore call passing: " + obj);
        }
        else {
            // we remove the object from both the ids and the objs array
            var index = lookupEntitypos(obj);
            if (index > -1) {
                entityobjs.splice(index, 1);
                var index2 = entityids.indexOf(createId(obj));
                if (index2 > -1) {
                    entityids.splice(index2, 1);
                }
                else {
                    console.warn("removeObj(): entity with id " + obj._id + " does not seem to be contained in entityids: " + entityids);
                }
                removePendingInverse.call(this, obj);
            }
            else {
                // TODO: need to clarify whether this error occurs...
                console.warn("removeObj(): entity with id cannot be found: " + obj._id);
            }
        }
    };

    /*
     * optionally, we may pass that we are inside of a delete opration, in which case we will ignore additions
     */
    this.handleInverseOperations = function (fromEntity, callback, calledFromDelete) {

        // in order to handle inverse operations, we must be loaded, check this first...
        if (!loaded) {
            console.log(params.attrname + ". handleInverseOperations(): fromEntity is: " + mwfUtils.stringify(fromEntity.toPojo()) + ". lazyload attribute is not loaded yet, call load first...");
            this.load(function () {
                console.log(params.attrname + ". handleInverseOperations(): loading of lazyload attribute done, now really handle operations...");
                this.handleInverseOperations(fromEntity, callback, calledFromDelete);
            }.bind(this), true);
        }
        else {
            console.log(params.attrname + ". handleInverseOperations(): fromEntity is: " + mwfUtils.stringify(fromEntity.toPojo()));
            console.log(params.attrname + ". handleInverseOperations(): calledFromDelete is: " + calledFromDelete);
            // we need to obtain the inverse attribute manager
            var inverseAttr = params.inverse.attrname;
            var inverseAttrManagerName = params.inverse.attrname + "Manager";
            //console.log(params.attrname + ".handleInverseOperations(): inverseAttrManagerName: " + inverseAttrManagerName);
            var countdown = (calledFromDelete ? 0 : this.pendingInverseAdditions.length) + this.pendingInverseRemovals.length;
            //console.log(params.attrname + ".handleInverseOperations(): total number of inverse operations: " + countdown);

            var inverseOperations = [];
            if (!calledFromDelete) {
                this.pendingInverseAdditions.forEach(function (toEntity) {
                    inverseOperations.push({toEntity: toEntity});
                });
            }
            else {
                console.log(params.attrname + ".handleInverseOperations(): entity " + fromEntity._id + " is being deleted. Ignore any pending inverse additions...");
            }
            this.pendingInverseRemovals.forEach(function (toEntity) {
                inverseOperations.push({toEntity: toEntity, removal: true});
            });
            // if we are inside of a deletion, we need to add all currently associated entities to the removals
            if (calledFromDelete) {
                console.log(params.attrname + ".handleInverseOperations(): entity " + fromEntity._id + " is being deleted. Add all currently associated entities to pending removals");
                entityobjs.forEach(function (obj) {
                    console.log(params.attrname + ".handleInverseOperations(): preparing inverse removal: " + obj._id + ", first of all removing the entity that is being deleted from the associated entities of " + inverseAttr + " of " + (obj.toPojo ? mwfUtils.stringify(obj.toPojo()) : mwfUtils.stringify(obj)));
                    // well, we first of all should remove the object to be deleted from the entities - otherwise the object itself will keep the reference while the db will already contain the update...
                    if (obj[inverseAttrManagerName]) {
                        obj[inverseAttrManagerName].removeObj(fromEntity);
                    }
                    else {
                        console.error(params.attrname + ".handleInverseOperations(): something is wrong. found entity placeholder: " + mwfUtils.stringify(obj));
                    }

                    // then schedule the operation
                    if (obj._id > -1) {
                        inverseOperations.push({toEntity: obj, removal: true});
                        countdown++;
                    }
                    else {
                        console.info(params.attrname + ".handleInverseOperations(): ignoring transient enitity with id: " + obj._id);
                    }
                });
            }

            function docountdown() {
                countdown--;
                console.log("docountdown(): " + countdown);
                if (countdown == 0) {
                    callback();
                }
            }

            console.log(params.attrname + ".handleInverseOperations(): will run " + inverseOperations.length + " operations for entity " + fromEntity._id);

            if (countdown == 0) {
                callback();
            }
            else {
                inverseOperations.forEach(function (op) {
                    var toEntity = op.toEntity;
                    var currentManager = toEntity[inverseAttrManagerName];
                    console.log(params.attrname + ".handleInverseOperations(): handling inverse " + (!op.removal ? " addition " : " removal ") + " for toEntity: " + mwfUtils.stringify(toEntity.toPojo()) + ", with ids: " + currentManager.getIds());
                    // we will create an update for the inverseAttr, appending the id of fromEntity to the entityidsOnLoad list
                    //var updateids = currentManager.entityidsOnload;
                    // use the actual ids!
                    var updateids = ([]).concat(currentManager.getNonTransientIds());

                    if (!op.removal) {
                        var fromId = createId(fromEntity);
                        if (updateids.indexOf(fromId) < 0) {
                            updateids.push(fromId);
                        }
                    }
                    else {
                        var index = updateids.indexOf(createId(fromEntity));
                        if (index > -1) {
                            updateids.splice(index, 1);
                        }
                        //else {
                        // console.warn("toEntity to run inverse removal did not contain fromEntity onload");
                        //}
                    }
                    //var actualids = currentManager.getIds();

                    //// TODO: this could be handled more flexibly? Maybe just check whether the id is / is not contained in the current ids?
                    //if (updateids.length != actualids.length) {
                    // console.warn(params.attrname + ".handleInverseOperations(): length of ids to be updated by adding differs from length of actual ids: " + updateids.length + " vs. " + actualids.length + ". Will execute update for ids: " + updateids[0]);
                    //}

                    var update = {};
                    update[inverseAttr] = updateids;

                    console.log("updating toEntity with id: " + toEntity._id + ", re-setting attributes " + mwfUtils.stringify(update));

                    em.update(toEntity.getTypename(), toEntity._id, update, function () {
                        console.log("update done for toEntity with id: " + toEntity._id);
                        docountdown();
                    }, /* this arguments prevents that the update object is converted to an entity */ true);

                }.bind(this));
            }
        }
    };

}

mwfUtils.xtends(ManagedEntitiesArray, Array);

/*
 * supertype of all deeply managed entities
 */
var localIdCount = -1;

function nextLocalId() {
    return localIdCount--;
}

function isProtectedMember(attr) {
    //console.log("isProtectedMember: " + attr + ": type is: " + (typeof this[attr]) + ", this: " + this._id);

    return (mwfUtils.endsWith(attr, "Manager") || attr == "managedAttributes" || attr == "constructor" || attr == "toPojo" || typeof this[attr] == "function");
}

class Entity {

    constructor() {
        this._id = nextLocalId();
        // #ES6: this is not required anymore! /ES6
        // this.managedAttributes = {};

        // #ES6: instantiate managed attributes here, which relieves subclasses from manually invoking this method /ES6
        this.instantiateManagedAttributes();
    }

    get created() {
        return (typeof this._id == "string") || (this._id > -1);
    }

    clear() {
        var attr;
        for (attr in this) {
            if (!isProtectedMember.call(this, attr)) {
                delete this[attr];
            }
        }
    }

    getTypename() {
        if (this.constructor.name) {
            return this.constructor.name;
        }
        else {
            var funcNameRegex = /function (.{1,})\(/;
            var results = funcNameRegex.exec(this.constructor.toString());
            return (results && results.length > 1) ? results[1] : "";
        }
    }

    prePersist() {
        // this is currently not used as it is dealt with by the toPojo function
        console.log(this.getTypename() + ".prePersist()");
    }

    postLoad(callback) {
        console.log("postLoad(): " + this._id + "@" + this.getTypename() + ":", this);

        var attrsCountdown = Object.keys(this.constructor.prototype.managedAttributes).length;


        if (attrsCountdown == 0) {
            console.log("postLoad(): entity does not have managed attributes. Invoke callback.");
            callback(this);
        }
        else {
            console.log("postLoad(): considering " + attrsCountdown + " managed attributes");
            var attr, attrManager;
            for (attr in this.constructor.prototype.managedAttributes) {
                attrManager = attr + "Manager";
                this[attrManager].load(function () {
                    attrsCountdown--;
                    if (attrsCountdown == 0) {
                        // we pass the entity itself as argument to the callback function
                        callback(this);
                    }
                }.bind(this));
            }
        }
    }

    /*
     * #ES6: managed attributes need to be read out from the prototype object, which is accessible via the constructor /ES6
     */
    instantiateManagedAttributes() {
        // console.log("instantiateManagedAttributes()",this.constructor.prototype);
        if (!this.constructor.prototype.managedAttributes) {
            this.constructor.prototype.managedAttributes = {};
        }

        var attr, attrManager;
        for (attr in this.constructor.prototype.managedAttributes) {
            // console.log("instantiateManagedAttributes(): creating manager: " + attrManager);
            attrManager = attr + "Manager";
            if (this.constructor.prototype.managedAttributes[attr].multiple) {
                this[attrManager] = new ManagedEntitiesArray(this.constructor.prototype.managedAttributes[attr]);
            }
            else {
                this[attrManager] = new ManagedEntity(this.constructor.prototype.managedAttributes[attr]);
            }
        }
    }

    declareManagedAttribute(type, attrname, attrtypename, params) {
        console.log("declareManagedAttribute(): " + type.prototype.getTypename() + "." + attrname + " of type: " + attrtypename);
        // we add the typedef here (might be overridden by a crud operation declaration, but that's ok...)
        // for abstract supertypes the typedef is required!
        em.addTypedef(type);

        // check whether for the given type we already have an entry
        var currentTypeAttrs = allManagedAttributes.get(type);
        if (!currentTypeAttrs) {
            currentTypeAttrs = new Map();
            allManagedAttributes.set(type, currentTypeAttrs);
        }
        if (params) {
            params.attrtypename = attrtypename;
        }
        else {
            params = {};
            params.attrtypename = attrtypename;
        }
        currentTypeAttrs.set(attrname, params);
    }

    addManagedAttributeToType(type, attrname, attrtypename, params) {
        console.log("addManagedAttributeToType(): " + this.getTypename() + "." + attrname + " of type " + attrtypename + "/" + params);
        if (!params) {
            params = {};
        }

        // check whether we have an inverse attribute specified and, lookup its description and replace it in the params
        if (params.inverse) {
            console.log("addManagedAttributeToType(): inverse attr is: " + params.inverse);
            var inverseParams = em.getManagedAttributeParams(attrtypename, params.inverse);
            inverseParams.attrname = params.inverse;
            params.inverse = inverseParams;
        }

        // reengineer this!
        if (!type.prototype.managedAttributes) {
            type.prototype.managedAttributes = {};
        }
        type.prototype.managedAttributes[attrname] = params;
        type.prototype.managedAttributes[attrname].type = attrtypename;
        type.prototype.managedAttributes[attrname].attrname = attrname;


        // TODO: on addManagedAttribute, the following declarations will be made given the name of the attribute
        var attrManager = attrname + "Manager";

        function handleInverseAttr(obj, params, remove) {
            if (params.inverse && params.inverse.attrname) {
                var inverseAttr = params.inverse.attrname;
                var inverseAttrManager = inverseAttr + "Manager";
                if (params.inverse.multiple) {
                    if (this._id < 0 && !params.inverse.allowTransient) {
                        console.error(obj.getTypename() + "." + inverseAttr + ".push(): will ignore transient entity without _id - you may consider setting allowTransient!");
                    }
                    else if (remove) {
                        obj[inverseAttrManager].removeObj(this);
                    }
                    else {
                        obj[inverseAttrManager].push(this);
                    }
                }
                else {
                    if (this._id < 0 && !params.inverse.allowTransient) {
                        console.error(obj.getTypename() + "." + inverseAttr + ".set(): will ignore transient entity without _id - you may consider setting allowTransient!");
                    }
                    else if (remove) {
                        obj[inverseAttrManager].set(this);
                    }
                    else {
                        // this needs to be handled!
                        obj[inverseAttrManager].set(null);
                    }
                }
            }
        }

        var singularised = singularise(attrname);

        if (!params.multiple) {
            //Object.defineProperty(type.prototype,attrManager,{
            // value: new ManagedEntity()
            //});
            Object.defineProperty(type.prototype, attrname, {
                get: function () {
                    return this[attrManager].entity();
                },
                set: function (obj) {
                    if (obj._id < 0 && !params.allowTransient) {
                        // this reference which is complained about as "potentially invalid" *is*, in fact, valid
                        console.error(this.getTypename() + ".add" + singularised + "(): will ignore transient entity without _id - you may consider setting allowTransient!");
                    }
                    else {
                        this[attrManager].set(obj);
                        handleInverseAttr.call(this, obj, params);
                    }
                }
            });
        }
        else {
            //Object.defineProperty(type.prototype,attrManager,{
            // value: new ManagedEntitiesArray()
            //});
            Object.defineProperty(type.prototype, attrname, {
                get: function () {
                    return this[attrManager].entities();
                }
            });
            // add additional adder/remover/getter
            type.prototype["add" + singularised] = function (obj) {
                // check whether we have an id set!
                if (obj._id < 0 && !params.allowTransient) {
                    // valid this reference
                    console.error(this.getTypename() + ".add" + singularised + "(): will ignore transient entity without _id - you may consider setting allowTransient!");
                }
                else {
                    this[attrManager].push(obj);
                    handleInverseAttr.call(this, obj, params);
                }
            };
            type.prototype["remove" + singularised] = function (obj) {
                this[attrManager].removeObj(obj);
                handleInverseAttr.call(this, obj, params, true);
            };
            type.prototype["get" + singularised] = function (objid) {
                return this[attrManager].getObj(objid);
            };
        }
    }

    removeEntityref(arr, entityid) {
        // lookup the index
        var index = -1, i;
        for (i = 0; i < arr.length; i++) {
            if (arr[i]._id == entityid) {
                index = i;
                break;
            }
        }
        if (index > -1) {
            arr.splice(index, 1);
        }
        else {
            console.warn("canot remove entityref for " + entityid + " on instance of type " + this.getTypename() + ", it does not seem to exist...");
        }
    }

    lookupEntityref(arr, entityid) {
        var i;
        for (i = 0; i < arr.length; i++) {
            if (arr[i]._id == entityid) {
                return arr[i];
            }
        }
        return null;
    }

    fromPojo(pojo) {
        console.log(this.getTypename() + ".fromPojo(): " + mwfUtils.stringify(pojo));

        var attr, managed, managedAttr, val;
        for (attr in pojo) {

            val = pojo[attr];

            if (val != null && val != undefined) {
                // we need to consider whether the attribute is a managed attribute
                managed = this.constructor.prototype.managedAttributes[attr];
                if (managed) {

                    managedAttr = attr + "Manager";

                    if (managed.multiple) {
                        // TODO: here we could check whether we actually have an array value
                        // check whether the value is an object or not (i.e. an id)
                        if (val.length > 0) {
                            if (typeof val[0] == "object") {
                                // normally, we will have ids here, as fromPojo will be called with raw datasource output
                                val.forEach(function (obj) {
                                    // here, it is ok to use the mutable variable
                                    this[managedAttr].push(obj);
                                }.bind(this));
                            }
                            else {
                                val.forEach(function (objid) {
                                    this[managedAttr].pushEntityref(objid);
                                }.bind(this));
                            }
                        }
                    }
                    else {
                        if (typeof val == "object") {
                            this[managedAttr].set(val);
                        }
                        else {
                            this[managedAttr].setEntityref(val);
                        }
                    }
                }
                else {
                    this[attr] = val;
                }
            }
            else {
                console.log("fromPojo(): will not set null/undefined value for attribute " + attr);
            }
        }

        // at the end, we remove the managedAttributes, as otherwise they will show up in all toString/json representations
        // #ES6: not required anymore, managedAttributes declaration is stored in prototype object
        // delete this.managedAttributes;
        // /ES6

    }

    toPojo() {
        var pojo = {};

        // first of all, we add the type
        pojo[typenameAttr] = this.getTypename();
        //console.log(this.getTypename() + ".toPojo()");

        // it seems that the managed attributes are not returned when iterating because they are declared by getters!
        var attr, val;
        for (attr in this) {

            // we will not include the *Manager and managedAttributes
            if (isProtectedMember.call(this, attr)) {
                //console.log("toPojo(): will not include member: " + attr);
            }
            else {
                val = this[attr];
                //console.log("handling member: " + attr + "=" + val);

                if (val != null) {
                    //console.log("toPojo(): will not include attribute with null/undefined value: " + attr);
                    pojo[attr] = val;
                }
            }
        }

        // iterate over the managed attributes
        var mattr, attrManagerName;
        for (mattr in this.constructor.prototype.managedAttributes) {
            attrManagerName = mattr + "Manager";
            //console.log("toPojo() adding value of managed attribute: " + attr + ": " + this.attr + "/" + this[attrManagerName]);

            if (this.constructor.prototype.managedAttributes[mattr].multiple) {
                pojo[mattr] = this[attrManagerName].getIds();
            }
            else {
                pojo[mattr] = this[attrManagerName].getId();
            }
        }

        return pojo;
    }

    /*
     * add crud functions directly on the entities
     */
    create(callback) {

        // we need to check whether we have any non empty bidirectional attributes, in which case we first need to create ourselves shallowly for obtaining an id and afterwards update
        // THIS WOULD ONLY BE NECESSARY IF WE ALLOWED FOR CASCADED CREATE! CURRENTLY ALL ENTITIES THAT MIGHT BE ADDED TO A MANAGED ATTRIBUTE NEED TO HAVE BEEN CREATED BEFORE!!!
        //var twostepCreate;
        //for (var attr in this.managedAttributes) {
        // if (this.managedAttributes[attr].inverse) {
        //  var attrManager = attr + "Manager";
        //  if (this.managedAttributes[attr].multiple && this[attrManager].entities().length > 0) {
        //   console.log("Entity.create(): we have a non empty inverse attribute: " + attr + ". Do twostep creation");
        //   twostepCreate = true;
        //   break;
        //  }
        //  else if (!this.managedAttributes[attr].multiple && this[attrManager].entity()) {
        //   console.log("Entity.create(): we have a non empty inverse attribute: " + attr + ". Do twostep creation");
        //   twostepCreate = true;
        //   break;
        //  }
        // }
        //}
        //
        //if (twostepCreate) {
        // // move all attributes outside
        // var content = em.newInstanceOfType(this.getTypename());
        // for (var attr in this) {
        //  content[attr] = this[attr];
        //  delete this[attr];
        // }
        // // create the entity
        // em.create(this.getTypename(),this,function(){
        //  console.log("Entity.create(): twostep creation: assigned id: " + this._id + ". Now update with content");
        //  em.update(this.getTypename(),this._id,content,function(updated){
        //   console.log("Entity.create(): twostep creation: done.");
        //   callback(this);
        //  }.bind(this));
        // }.bind(this));
        //}
        //else {
        // console.log("Entity.create(): twostep creation is not necessary for given instance of " + this.getTypename());

        // we need to check the inverse actions before running create as managers will be reset afterwards

        // here and in the following methods, we return promises as an alternative to passing a callback function
        return new Promise((resolve, reject) => {
            console.log(this.getTypename() + ".create()");

            var inverseManagers = prepareInverseOperations.call(this);

            em.create(this.getTypename(), this, function () {
                handleInverseOperations.call(this, inverseManagers, function () {
                    if (callback) {
                        callback(this);
                    }
                    resolve(this);
                }.bind(this));
            }.bind(this));
        });

    }

    // let entities access crud in order to implement custom operations!
    getCRUD() {
        return em.getCRUD(this.getTypename());
    }

    update(callback) {
        return new Promise((resolve, reject) => {
            console.log(this.getTypename() + ".update(): " + this._id);

            var inverseManagers = prepareInverseOperations.call(this);

            em.update(this.getTypename(), this._id, this, function () {
                handleInverseOperations.call(this, inverseManagers, function () {
                    if (callback) {
                        callback(this);
                    }
                    resolve(this);
                }.bind(this));
            }.bind(this));
        });
    }

    refresh(callback) {
        return new Promise((resolve, reject) => {
            console.log(this.getTypename() + ".refresh(): " + this._id);

            em.refresh(this.getTypename(), this._id, function () {
                if (callback) {
                    callback(this);
                }
                resolve(this);
            }.bind(this));
        });
    }

    delete(callback) {
        return new Promise((resolve, reject) => {
            console.log(this.getTypename() + ".delete(): " + this._id);

            var inverseManagers = prepareInverseOperations.call(this);

            em.delete(this.getTypename(), this._id, function (deleted) {
                handleInverseOperations.call(this, inverseManagers, function () {
                    if (callback) {
                        callback(deleted);
                    }
                    resolve(deleted);
                }.bind(this), true);
            }.bind(this));
        });
    }

    static read(entityid, callback) {
        return new Promise((resolve, reject) => {
            // #ES6: we can access the information about the type of object for which read is called using the name property of this, because this will be the constructor function of the respective type!!!
            console.log(this.name + ".read(): " + entityid);
            em.read(this.name, entityid, (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
            // /ES6
        });
    }

    static readAll(callback) {
        return new Promise((resolve, reject) => {
            // #ES6: access name of constructor function, which is the type (see above)
            console.log(this.name + ".readAll()");
            em.readAll(this.name, (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
            // /ES6
        });
    }

    static getCRUD() {
        // ES6: also for thie function, previously dealt with in xtends, we can use a static function
        return em.getCrudopsForType(this.name);
        // /ES6
    }

}

// a helper function that creates an initial uppercase singular version from some typename
function singularise(attrname) {
    if (attrname.substring(attrname.length - 1) != "s") {
        console.warn("singularise(): got non plural attrname for presumed multiple attribute: " + attrname + "/" + attrname.substring(attrname.length - 2) + ". Will not manipulate...");
        return attrname;
    }
    else {
        var singularised = attrname.substring(0, 1).toUpperCase() + attrname.substring(1, attrname.length - 1);
        console.log("singularised " + attrname + ": " + singularised);
        return singularised;
    }
}

function prepareInverseOperations() {
    var managers = [];
    var attr, attrManager;
    for (attr in this.constructor.prototype.managedAttributes) {
        attrManager = attr + "Manager";
        if (this.constructor.prototype.managedAttributes[attr].inverse) {
            managers.push(this[attrManager]);
        }
    }
    return managers;
}

function handleInverseOperations(managers, callback, calledFromDelete) {
    var countdown = managers.length;

    if (countdown == 0) {
        if (callback) {
            callback();
        }
    }
    else {
        managers.forEach(function (manager) {
            manager.handleInverseOperations(this, function () {
                countdown--;
                if (countdown == 0 && callback) {
                    callback();
                }
            }.bind(this), calledFromDelete);
        }.bind(this));
    }
}

/*
 * we decorate the default xtends method and add static accessors to the type if it is an entitytype
 * ES6: this is not required anymore because we can declare the functions as static functions on Entity!
 */
// function xtends(base,supertype) {
//     mwfUtils.xtends(base,supertype);
//
//     if (supertype.prototype instanceof Entity || supertype == Entity) {
//         base.read = function(entityid,callback) {
//             (new base()).read(entityid,callback);
//         };
//         base.readAll = function(callback) {
//             (new base()).readAll(callback);
//         };
//         // we also add a function that gives us the crud implementation for the given entity
//         base.getCRUD = function() {
//             return em.getCrudopsForType((new base()).getTypename());
//         };
//     }
// }

function setTypenameAttr(name) {
    console.log("setting typename attr: " + name);
    typenameAttr = name;
}

// declare constants for those members we pass through from other namespaces
const resetCRUD = em.resetCRUD;
const addCRUD = em.addCRUD;
const initialise = em.initialise;
const resetEntities = em.resetEntities;

export {
    resetCRUD,
    Entity,
    ManagedEntity,
    ManagedEntitiesArray,
    addCRUD,
    initialise,
    resetEntities,
    segmentId,
    createEntityId as createId,
    setTypenameAttr
};

/*jslint nomen: false*/