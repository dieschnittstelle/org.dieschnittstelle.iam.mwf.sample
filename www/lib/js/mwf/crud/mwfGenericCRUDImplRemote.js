/**
 * Created by master on 31.01.16.
 *
 * TODO: there is an issue with updating tags!!! Seems associations with taggable items are overriden on update... locally it works, though...
 */
import {xhr} from "../../framework-modules.js";
import {EntityManager} from "../../framework-modules.js";
import {mwfUtils} from "../../framework-modules.js";

console.log("loading module.");

function GenericCRUDImplRemote(etype) {
    console.log("GenericCRUDRemote(): " + etype);

    this.entitytype = etype.toLowerCase();
    if (!mwfUtils.endsWith(this.entitytype, "s")) {
        this.entitytype += "s";
    }

    function baseUrl() {
        return "/" + this.entitytype + "/";
    }

    this.create = function (item, callback) {
        return new Promise((resolve,reject) => {
            console.log("create(): " + this.entitytype);
            // we copy the attributes of the object to a temporary object which will be persisted
            xhr.create(baseUrl.call(this), mwfUtils.createPersistableClone(item), (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
        });
    };

    this.update = function (id, update, callback) {
        return new Promise((resolve,reject) => {
            console.log("update(): " + this.entitytype);
            xhr.update(baseUrl.call(this) + id, mwfUtils.createPersistableClone(update), (result) => {
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
            xhr.deleat(baseUrl.call(this) + id, null, (result) => {
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
            xhr.read(baseUrl.call(this) + id, null, (result) => {
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
            xhr.read(baseUrl.call(this), null, (result) => {
                if (callback) {
                    callback(result);
                }
                resolve(result);
            });
        });
    };

    this.persistMediaContent = function (entity, attr, fileObj, callback) {
        return new Promise((resolve,reject) => {
            // we use a multipart request created with the fileObj
            var formdata = new FormData();
            formdata.append(attr, fileObj);
            // create an xmlhttprequest
            var xhrq = new XMLHttpRequest();
            xhrq.onreadystatechange = function () {
                if (xhrq.readyState == 4) {
                    if (xhrq.status == 200) {
                        var formDataResponse = xhrq.responseText;
                        console.log("persistMediaContent(): formdata has been processed successfully: Got: " + formDataResponse);
                        var responseObj = JSON.parse(formDataResponse).data;
                        var mediaPath = responseObj[attr];
                        if (!mediaPath) {
                            console.error("persistMediaContent(): formdata response does not contain attribute " + attr + ". Somethins seems to be wrong...");
                            if (callback) {
                                callback();
                            }
                            resolve();
                        } else {
                            console.log("persistMediaContent(): media path from formdata is: " + mediaPath + ". Re-setting it on entity...");
                            entity[attr] = mediaPath;
                            // also set the contentType
                            if (responseObj.contentType) {
                                entity.contentType = responseObj.contentType;
                            } else {
                                console.warn("persistMediaContent(): no content type specified for uploaded content!");
                            }
                            if (callback) {
                                callback(entity);
                            }
                            resolve(entity);
                        }
                    } else {
                        console.error("persistMediaContent(): got an error on sending formdata! Status is: " + xhrq.status);
                        if (callback) {
                            callback();
                        }
                        resolve();
                    }
                }
            };
            xhrq.open("POST","/" + xhr.getApiprefix() + baseUrl.call(this));
            xhrq.send(formdata);
        });
    };

    this.loadMediaContent = function (entity, attr, callback) {
        return new Promise((resolve,reject) => {
            if (callback) {
                callback(entity);
            }
            resolve(entity);
        })
    };

}


function newInstance(type) {
    return new GenericCRUDImplRemote(type);
}

export {newInstance}
