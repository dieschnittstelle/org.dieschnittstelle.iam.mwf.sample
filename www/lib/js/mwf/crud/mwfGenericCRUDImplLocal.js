/**
 * Created by master on 31.01.16.
 */

define(["indexeddb", "EntityManager", "mwfUtils"], function (indexeddb, EntityManager, mwfUtils) {

    console.log("loading module. Using indexeddb: " + indexeddb);

    function initialiseDB(dbname, dbversion, objectstores, callback) {
        var idbinstance = indexeddb.createInstance(dbname, dbversion, objectstores);
        console.log("created db instance: " + idbinstance + ". Now initialise it...");
        idbinstance.initialise(function () {
            console.log("local db has been initialised: " + indexeddb.getInstance());
            callback();
        });
    }

    function GenericCRUDImplLocal(etype) {
        console.log("GenericCRUDLocal(): " + etype);

        this.entitytype = etype;

        this.create = function (item, callback) {
            console.log("create(): " + this.entitytype);
            // we copy the attributes of the object to a temporary object which will be persisted

            indexeddb.getInstance().createObject(this.entitytype, mwfUtils.createPersistableClone(item), function (created) {
                // we take over the id
                /*jslint nomen: true*/
                item._id = created._id;
                /*jslint nomen: false*/
                callback(item);
            });
        };

        this.update = function (id, update, callback) {
            console.log("update(): " + this.entitytype);
            indexeddb.getInstance().updateObject(this.entitytype, id, mwfUtils.createPersistableClone(update), callback);
        };

        this.delete = function (id, callback) {
            console.log("delete(): " + this.entitytype);
            indexeddb.getInstance().deleteObject(this.entitytype, id, callback);
        };

        this.read = function (id, callback) {
            console.log("read(): " + this.entitytype);
            indexeddb.getInstance().readObject(this.entitytype, id, callback);
        };

        this.readAll = function (callback) {
            console.log("readAll(): " + this.entitytype);
            indexeddb.getInstance().readAllObjects(this.entitytype, callback);
        };

        this.persistMediaContent = function (entity, attr, fileObj, callback) {
            console.log("persistMediaContent(): " + fileObj);
            // we extract the content from the contentElement and write it into the local storage
            var reader = new FileReader();
            reader.onload = function (ev) {
                console.log("content read.");
                var result = reader.result;
                // the problem is that if we have a new entity then the key is not unique!
                var storageKey = "localStorage:" + (entity.created ? EntityManager.createId(entity) : Date.now()) + "_" + attr;

                // add the content to the local storage;
                localStorage.setItem(storageKey, result);
                // and add a reference to the entity
                entity[attr] = result;
                entity[attr + "_reference"] = storageKey;
                if (callback) {
                    callback(entity);
                }
            };
            console.log("reading content...");
            reader.readAsDataURL(fileObj);
        };

        this.loadMediaContent = function (entity, attr, callback) {
            console.log("loadMediaContent()");
            var valref = entity[attr + "_reference"];
            // check whether the attr has a localStorage
            if (valref && mwfUtils.startsWith(valref, "localStorage:")) {
                var content = localStorage.getItem(valref);
                if (!content) {
                    console.error("loadMediaContent(): reference to localStorage item is broken: " + attr);
                } else {
                    entity[attr] = content;
                }
                if (callback) {
                    callback(entity);
                }
            } else {
                console.log("loadMediaContent(): entity does not use localStorage reference...");
                callback(entity);
            }
        };

    }


    function newInstance(type) {
        return new GenericCRUDImplLocal(type);
    }

    return {
        newInstance: newInstance,
        initialiseDB: initialiseDB
    };

});
