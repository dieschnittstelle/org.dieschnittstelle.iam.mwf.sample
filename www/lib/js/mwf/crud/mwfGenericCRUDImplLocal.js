/**
 * Created by master on 31.01.16.
 */

import {indexeddb} from "../../framework-modules.js";
import {EntityManager} from "../../framework-modules.js";
import {mwfUtils} from "../../framework-modules.js";

//console.log("loading module. Using indexeddb: " + indexeddb);

async function initialiseDB(dbname, dbversion, objectstores, callback) {
    return new Promise((resolve,reject) => {
        var idbinstance = indexeddb.createInstance(dbname, dbversion, objectstores);
        console.log("created db instance: " + idbinstance + ". Now initialise it...");
        idbinstance.initialise(function () {
            console.log("local db has been initialised: " + indexeddb.getInstance());
            if (callback) {
                callback();
            }
            resolve();
        });
    });
}

function GenericCRUDImplLocal(etype) {
    console.log("GenericCRUDLocal(): " + etype);

    this.entitytype = etype;

    this.create = function (item, callback) {
        return new Promise((resolve,reject) => {
            console.log("create(): " + this.entitytype);
            // we copy the attributes of the object to a temporary object which will be persisted

            indexeddb.getInstance().createObject(this.entitytype, mwfUtils.createPersistableClone(item), function (created) {
                // we take over the id
                /*jslint nomen: true*/
                item._id = created._id;
                /*jslint nomen: false*/
                if (callback) {
                    callback(item);
                }
                resolve(item);
            });
        });
    };

    this.update = function (id, update, callback) {
        return new Promise((resolve,reject) => {
            console.log("update(): " + this.entitytype);
            indexeddb.getInstance().updateObject(this.entitytype, id, mwfUtils.createPersistableClone(update), (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
        });
    };

    this.delete = function (id, callback) {
        return new Promise((resolve,reject) => {
            console.log("delete(): " + this.entitytype);
            indexeddb.getInstance().deleteObject(this.entitytype, id, (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
        });
    };

    this.read = function (id, callback) {
        return new Promise((resolve,reject) => {
            console.log("read(): " + this.entitytype);
            indexeddb.getInstance().readObject(this.entitytype, id, (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
        });
    };

    this.readAll = function (callback) {
        return new Promise((resolve,reject) => {
            console.log("readAll(): " + this.entitytype);
            indexeddb.getInstance().readAllObjects(this.entitytype, (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
        });
    };

    this.persistMediaContent = function (entity, attr, fileObj, callback) {
        return new Promise((resolve,reject) => {
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
                resolve(entity);
            };
            console.log("reading content...");
            reader.readAsDataURL(fileObj);
        });
    };

    this.loadMediaContent = function (entity, attr, callback) {
        return new Promise((resolve,reject) => {
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
                resolve(entity);
            } else {
                console.log("loadMediaContent(): entity does not use localStorage reference...");
                callback(entity);
                resolve(entity);
            }
        });
    };

}


function newInstance(type) {
    return new GenericCRUDImplLocal(type);
}

export {
    newInstance,
    initialiseDB
};
