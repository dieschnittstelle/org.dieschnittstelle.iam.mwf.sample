/**
 * @author Jörn Kreutel
 *
 *
 * this class implements the generic crud api accessing indexeddb -- it is a based on the mme2_indexeddb_simpleCRUD.js script and differs from it mainly by being a wrapper around a db object exposing the generic crud api to its users
 */

/*jslint plusplus: true */
console.log("loading module...");

// this module encapsulates the singleton instance of indexeddbcrud, which will be instantiated by the applications that use the module
var instance;

/*jslint nomen: true*/
function IndexedDBCRUD(_dbname, _version, _objectstores, _modifiers, _onstorecreated, _intids) {

    // we store the db object as a local "private" variable not accessible from outside - this variable will be instantiated when the initialise function is run
    var db = null;

    // we also store the constructor arguments as local "private" variables
    var dbname = _dbname;
    var objectstores = _objectstores;
    var modifiers = _modifiers;
    var onstorecreated = _onstorecreated;

    var version = null;
    if (!_version || _version == "") {
        version = 1;
    } else {
        version = parseInt(_version, 10);
    }

    // this tracks whether ids are int values or not
    var intids = {};
    var i = 0;
    for (i = 0; i < _objectstores.length; i++) {
        if (_intids && _intids[i]) {
            intids[objectstores[i]] = _intids[i];
        } else {
            intids[objectstores[i]] = true;
        }
    }
    // check whether the modifiers contain a keypath declaration, in which case the update operations needs to be realised differently
    var usekeypathForUpdate = {};
    for (i = 0; i < _objectstores.length; i++) {
        // this if statement shall stay as it is as non-null/undefined checks need to be done both on the array and its members
        if (modifiers && modifiers[i] && modifiers[i].keyPath) {
            usekeypathForUpdate[objectstores[i]] = true;
        } else {
            usekeypathForUpdate[objectstores[i]] = false;
        }
    }

    console.log("IndexDBCRUDOperationsImpl(): usekeypathForUpdate: " + JSON.stringify(usekeypathForUpdate));
    console.log("IndexDBCRUDOperationsImpl(): intids: " + JSON.stringify(intids));

    console.log("IndexDBCRUDOperationsImpl() dbname: " + dbname);
    console.log("IndexDBCRUDOperationsImpl() version: " + version);

    /*
     * these two createEntity... Functions have been moved to the entity manager. Will be kept here as dummy impl until code cleanup
     */
    function createEntityFromObject(entitytype, object) {
        return object;
    }

    /*
     * even more utility: create an array of entities from an object array
     */
    function createEntitiesFromObjects(entitytype, objects) {
        return objects;
    }

    /*
     * this is the initialisation function that actually opens the database
     */
    this.initialise = function (onavailable, onunavailable, onerror) {

        // open the database, providing onerror and onsuccess handlers
        var request = indexedDB.open(dbname, version);
        if (onerror) {
            request.onerror = onerror;
        } else {
            request.onerror = function (event) {
                alert("Got error trying to create database: " + event.target.errorCode);
            };
        }

        // if an upgrade is needed for the db, onupgradeneeded will be called before onsuccess!
        request.onsuccess = function (event) {
            // onsuccess, the db will be accessible as the result of of the request
            db = request.result;
            console.log("open().onsuccess(): initialised db: " + db);

            // then call the onavailable callback
            if (onavailable) {
                onavailable();
            }
        };

        // on upgrade needed is invoked when the db is not available in the given version or when it has just been created
        request.onupgradeneeded = function (event) {
            console.log("open().onupgradeneeded()");
            db = event.target.result;

            // we will create the object stores for which openOrCreate has been called
            console.log("open().onupgradeneeded(): create " + objectstores.length + " object stores for db: " + db);

            var currentStore, currentModifiers, currentStoreObj;
            for (i = 0; i < objectstores.length; i++) {
                currentStore = objectstores[i];
                currentModifiers = modifiers ? modifiers[i] : null;
                console.log("open().onupgradeneeded(): creating objectstore: " + currentStore);
                // by default, we will create the stores with autoincrement and without any further parameters
                currentStoreObj = db.createObjectStore(currentStore, currentModifiers || {
                    autoIncrement: true
                });

                // check whether we have been provided a callback for handling store creation
                if (onstorecreated) {
                    onstorecreated(currentStore, currentStoreObj);
                }
            }

            console.log("open().onupgradeneeded(): done.");
        };
    };
    /*jslint nomen: false*/

    /*
     * delete a db
     */
    this.deleteDB = function () {
        console.log("deleting db: " + dbname);
        indexedDB.deleteDatabase(dbname);
        console.log("deletion done.");
    };

    /*************************
     * simple CRUD operations
     *************************/

    /*
     * create an object - note that we pass the db from outside
     */
    this.createObject = function (objectstore, object, onsuccess, onerror, context) {
        console.log("createObject():  " + JSON.stringify(object));
        console.log("createObject():  store: " + objectstore);

        // create a readwrite transaction, passing the store(s) which shall be accessed
        var transaction = db.transaction([objectstore], "readwrite");
        // access the object store to which the object shall be added from the transaction
        var objectStore = transaction.objectStore(objectstore);
        // create the request to add the object
        var request = objectStore.add(object);

        // set onerror callback
        if (onerror) {
            transaction.onerror = function (event) {
                onerror(event, context);
            };
        } else {
            transaction.onerror = function (event) {
                alert("Got error trying to create object: " + event.target.errorCode);
            };
        }

        // we need to set the id in the request.onsuccess callback, not in transaction.oncomplete!
        /*jslint nomen: true*/
        request.onsuccess = function(event) {
            console.log("createObject(): onsuccess. got id: " + event.target.result + " (note that the id will only be set if it is assigned by the db, i.e. undefined is ok for manually assigned ids)");
            if (event.target.result) {
                object._id = event.target.result;
            }
        };
        /*jslint nomen: false*/

        // add a callback on the transaction that sets the id created by the add function!
        transaction.oncomplete = function (event) {
            // and call the callback that will probably have been passed to the function - try moving this to transaction.oncomplete!
            if (onsuccess) {
                onsuccess(object, context);
            }
        };
    };

    /*
     * read all objects from some store
     */
    this.readAllObjects = function (objectstore, onsuccess, onerror, context) {
        console.log("readAllObjects(): objectstore: " + objectstore);

        var objects = [];

        // we create a transaction for the objectstore and access the store from that transaction
        var objectStore = db.transaction([objectstore]).objectStore(objectstore);
        // we then try to obtain a cursor for iterating over the store
        var objectStoreCursor = objectStore.openCursor();
        objectStoreCursor.onsuccess = function (event) {
            // as long as objects can be read out this function will be called
            var cursor = event.target.result;
            if (cursor) {
                console.log("found: " + cursor.key + "=" + cursor.value);
                // note that the id (cursor.key) will not be set on the object itself, i.e. we need to set it manually
                /*jslint nomen: true*/
                cursor.value._id = cursor.key;
                /*jslint nomen: false*/
                // we add the object to the objects array
                objects.push(cursor.value);
                // try to read out the next object - NOTE THAT APTANA WILL COMPLAIN ABOUT THE continue() FUNCTION - AND JUST IGNORE IT...
                cursor.
                continue();
            } else {
                console.log("No more objects found. Passing " + objects.length + " to onsuccess callback function...");
                onsuccess(createEntitiesFromObjects(objectstore,objects), context);
            }
        };
        objectStoreCursor.onerror = function (event) {
            if (onerror) {
                onerror(event, context);
            } else {
                alert("Got error trying to read all objects from store " + objectstore + ": " + event.target.errorCode);
            }
        };
    };

    /*
     * read a single object
     */
    this.readObject = function (objectstore, id, onsuccess, onerror, context) {
        console.log("readObject(): " + id);
        // we create a transaction
        var objectStore = db.transaction([objectstore]).objectStore(objectstore);
        // we create a get request, passing the id
        var request = objectStore.get(intids[objectstore] ? parseInt(id, 10) : id);
        // set the callbacks
        request.onerror = function (event) {
            if (onerror) {
                onerror(event, context);
            } else {
                console.error("got error reading entry for id " + id + ": " + event);
            }
        };
        request.onsuccess = function (event) {
            var entry = event.target.result;
            // check whether we have an entry
            if (entry) {
                // set the id on the entry
                /*jslint nomen: true*/
                entry._id = id;
                /*jslint nomen: false*/
                if (onsuccess) {
                    onsuccess(createEntityFromObject(objectstore,entry), context);
                } else {
                    console.log("readObject(): no onsuccess callback specified...");
                }
            } else {
                console.log("entry with id " + id + " does not exist.");
                // we call onsuccess without passing an object!
                if (onsuccess) {
                    onsuccess(null, context);
                } else {
                    console.log("readObject(): object could not be found, and no onsuccess (!) callback specified to be called...");
                }
            }
        };
    };

    /*
     * update an object
     */
    this.updateObject = function (objectstore, id, update, onsuccess, onerror, context) {
        console.log("updateObject(): " + id + ": " + JSON.stringify(update));
        // and once again, we create a transaction and access the object store via that transaction
        var transaction = db.transaction([objectstore], "readwrite");
        var objectStore = transaction.objectStore(objectstore);

        // as shown in mdn demo, indexeddb does (currently) not support partial updates, i.e. we need to read out the object first and then replace the attribute value pairs that are contained in the update object passed to this function.
        var request = objectStore.get(intids[objectstore] ? parseInt(id, 10) : id);

        request.onsuccess = function (event) {
            // Get the old value that we want to update
            var currentValue = request.result;
            // then do the partial update manually
            var attr;
            for (attr in update) {
                currentValue[attr] = update[attr];
            }

            // and then write the objec - note that put takes the key as second argument... note that if the _id is set on the update object, this operation will result in adding the _id attribute to the object store, as well
            var updaterequest = null;
            if (!usekeypathForUpdate[objectstore]) {
                updaterequest = objectStore.put(currentValue, intids[objectstore] ? parseInt(id, 10) : id);
            } else {
                updaterequest = objectStore.put(currentValue);
            }

            updaterequest.onerror = function (event) {
                console.error("got error updating entry: " + event);
                if (onerror) {
                    onerror(event, context);
                } else if (onsuccess) {
                    onsuccess(false, event, context);
                }
            };
        };

        // onerror callback
        transaction.onerror = function (event) {
            if (onerror) {
                onerror(event, context);
            } else {
                console.error("got error preparing update by reading entry for id " + id + ": " + event);
            }
        };

        // set an oncomplete callback on the transaction which will invoke the callback possed to this function
        transaction.oncomplete = function (event) {
            console.log("updateObject(): oncomplete");
            if (onsuccess) {
                // we just feed back true/false
                onsuccess(true, context);
            } else {
                console.log("successfully updated object " + id + ". Got: " + event.target.result);
            }
        };
    };

    /*
     * delete an object
     */
    this.deleteObject = function (objectstore, id, onsuccess, onerror, context) {
        console.log("deleteObject(): " + id);

        // again, we create a transaction and obtain the objectstore from the transaction
        var transaction = db.transaction([objectstore], "readwrite");
        var objectStore = transaction.objectStore(objectstore);

        // call the delete function - NOTE THAT APTANA WILL COMPLAIN...
        objectStore.
        delete(intids[objectstore] ? parseInt(id, 10) : id);

        // onerror callback
        transaction.onerror = function (event) {
            console.error("got error deleting entry: " + event);
            if (onerror) {
                onerror(event, context);
            } else if (onsuccess) {
                onsuccess(false, event, context);
            }
        };

        // set the oncomplete callback on the transaction
        transaction.oncomplete = function (event) {
            console.log("deleteObject(): oncomplete");
            if (onsuccess) {
                onsuccess(true, context);
            } else {
                console.log("successfully deleted entry.");
            }
        };
    };
}

function createInstance(_dbname, _version, _objectstores, _modifiers, _onstorecreated, _stringids) {
    if (instance) {
        console.warn("createInstance(): instance already exists. createInstance() should only be called once!");
        return instance;
    }

    console.log("createInstance()");
    instance = new IndexedDBCRUD(_dbname, _version, _objectstores, _modifiers, _onstorecreated, _stringids);

    return instance;
}

function getInstance() {
    if (!instance) {
        console.error("instance of indexddb operations is not available!");
    }
    return instance;
}

export {
    createInstance,
    getInstance
};


