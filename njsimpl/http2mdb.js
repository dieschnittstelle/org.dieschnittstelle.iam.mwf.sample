/**
 * @author Jörn Kreutel
 */

// MULTITENANT: export a constructor function that allows to instantiate the crud impl for some given tenant / databaseId
module.exports = {
    CRUDImpl: CRUDImpl
}


var mdbhost = "localhost";
var mdbport = 27017;

/*
 * initialise the access to the mdb
 */
function CRUDImpl(tenant) {
    // determine the databaseUrl escaping characters if necessary
    var databaseUrl = "mongodb://" + mdbhost + ":" + mdbport + "/" + encodeURIComponent(tenant ? tenant.name : "mwfdb");
    var databaseLogPrefix = tenant ? tenant.name : "";

    // use our own utility functions
    var utils = require("./njsutils");

    var mdbclient = require('mongodb').MongoClient;
    console.log(databaseLogPrefix + ".CRUDImpl(): got mdbclient");

    /* MFM: import the components required for multipart request ("file upload") processing
     the class must be imported like this, otherwise its instances will not keep their state */
    var MultipartReader = require("./multipart").MultipartReader;
    var multipart = require("./multipart");

    /*
     * an object type that represents the information contained in a uri and provides it via the attributes collection, objectid and furtherpath (the latter will not be used here)
     */
    function MDBRequest(uri) {

        var segments = uri.split("/");
        console.log(databaseLogPrefix + ".MDBRequest(): segments: " + segments)

        if (segments.length > 0 && segments[0].length > 0) {
            this.collection = segments[0];
            console.log(databaseLogPrefix + ".MDBRequest(): collection: " + this.collection);
        }
        if (segments.length > 1 && segments[1].length > 0) {
            try {
                this.objectid = require("mongodb").ObjectId(segments[1]);
            } catch (exception) {
                console.log(databaseLogPrefix + ".MDBRequest(): got exception: " + exception + ". This might be due to using an _id that has been assigned remotely: " + segments[1]);
                this.objectid = segments[1];//parseInt(segments[1]);
            }
            console.log(databaseLogPrefix + ".MDBRequest(): objectid: " + this.objectid);
        }
        if (segments.length > 2 && segments[2].length > 0) {
            this.furtherpath = segments[2];
            console.log(databaseLogPrefix + ".MDBRequest(): furtherpath: " + this.furtherpath);
        }

    }

    this.processRequest = function(req, res, apiref) {

        // we truncate the url
        var uri = utils.substringAfter(req.url, "/" + apiref + "/");

        // handle upload independently of access to mongodb
        if (req.method == "POST" && utils.startsWith(req.headers["content-type"], "multipart/form-data;")) {
            // we first need to create a connection to the db
            console.log(databaseLogPrefix + ".processRequest(): we have a multipart request. No need to connect to db");
            handleMultipartRequest(uri, req, res);
        }
        else {
            // we first need to create a connection to the db
            console.log(databaseLogPrefix + ".processRequest(): create db connection to: " + databaseUrl);
            mdbclient.connect(databaseUrl, function (err, db) {

                if (err) {
                    console.error(databaseLogPrefix + ".processRequest(): cannot access database: " + err);
                    res.writeHead(500);
                    res.end();
                    return;
                }

                console.log(databaseLogPrefix + ".processRequest(): got db: " + db);

                console.log(databaseLogPrefix + ".processRequest(): req: " + req);
                console.log(databaseLogPrefix + ".processRequest(): req.method: " + req.method);
                console.log(databaseLogPrefix + ".processRequest(): req.url: " + req.url);
                console.log(databaseLogPrefix + ".processRequest(): req header user-agent: " + req.headers["user-agent"]);
                console.log(databaseLogPrefix + ".processRequest(): req header host: " + req.headers["host"]);

                // we assume the rest of the url specifies the collection and possibly object to be accessed and wrap this information in a special type of object
                var mdbrequest = new MDBRequest(uri);

                // load the collection
                var collection = db.collection(mdbrequest.collection);

                console.log(databaseLogPrefix + ".processRequest(): collection from db: " + collection);

                if (collection) {
                    if (req.method == "GET") {
                        if (mdbrequest.objectid) {
                            readObject(collection, mdbrequest.objectid, req, res, db);
                        } else {
                            readAllObjects(collection, req, res, db);
                        }
                    } else if (req.method == "POST") {
                        // MFM: check whether we have a multipart request
                        if (utils.startsWith(req.headers["content-type"], "multipart/form-data;")) {
                            handleMultipartRequest(uri, req, res);
                            // on dealing with multipart requests, we close the connection immediately
                            db.close();
                        }
                        else {
                            createObject(collection, req, res, db);
                        }
                    } else if (req.method == "PUT") {
                        updateObject(collection, mdbrequest.objectid, req, res, db);
                    } else if (req.method == "DELETE") {
                        deleteObject(collection, mdbrequest.objectid, req, res, db);
                    } else {
                        db.close();
                        console.error(databaseLogPrefix + ".processRequest(): cannot handle request method: " + req.method);
                        res.writeHead(405);
                        res.end();
                    }
                } else {
                    db.close();
                    console.error(databaseLogPrefix + ".processRequest(): request does not seem to specifiy a collection: " + uri + "!");
                    res.writeHead(400);
                    res.end();
                }

            });
        }
    }

    /*
     * read a single object
     */
    function readObject(collection, objectid, req, res, db) {
        console.log(databaseLogPrefix + ".readObject(): " + objectid);

        collection.findOne({
            _id: objectid
        }, function (err, element) {
            db.close();
            if (err) {
                console.log(databaseLogPrefix + ".readObject(): Error accessing collection! " + err ? err : "");
                respondError(res);
            } else if (!element) {
                console.error(databaseLogPrefix + ".readObject(): the element with id " + objectid + " could not be found inside of the collection.");
                respondError(res, 404);
            } else {
                console.log(databaseLogPrefix + ".readObject(): found element: " + element);
                respondSuccess(res, element);
            }
        });
    }

    function readAllObjects(collection, req, res, db) {
        console.log(databaseLogPrefix + ".readAllObjects()");

        collection.find({}).toArray(function (err, elements) {
            db.close();
            if (err || !elements) {
                console.log(databaseLogPrefix + ".readAllObjects(): Error accessing collection: " + err + "!");
                respondError(res);
            } else {
                console.log(databaseLogPrefix + ".readAllObjects(): found " + elements.length + " elements.");
                respondSuccess(res, elements);
            }
        });
    }

    function createObject(collection, req, res, db) {
        console.log(databaseLogPrefix + ".createObject()");

        // we read out the data from the request and then update the db with the data being passed
        var alldata = "";
        req.on("data", function (data) {
            alldata += data;
        });

        // with .on() for "data" we read out the request body - we will get it passed via the callback function
        // note that here we have a callback inside of a callback!
        req.on("end", function () {
            console.log(databaseLogPrefix + ".createObject(): data is: " + alldata);
            // parse the data
            var parseddata = JSON.parse(alldata);
            // and save it to the collection
            collection.insertOne(parseddata, function (err, result) {
                db.close();
                if (err || !result) {
                    console.error(databaseLogPrefix + ".object data could not be saved: " + err);
                    respondError(res);
                } else {
                    console.log(databaseLogPrefix + ".createObject(): saved object id is: " + result.insertedId);
                    parseddata._id = result.insertedId;
                    respondSuccess(res, parseddata);
                }
            })
        });
    }

    function deleteObject(collection, objectid, req, res, db) {
        console.log(databaseLogPrefix + ".deleteObject(): " + objectid);

        collection.deleteOne({
            _id: objectid
        }, function (err, update) {
            db.close();
            if (err || !update) {
                console.log(databaseLogPrefix + ".deleteObject(): object " + objectid + " could not be deleted. Got: " + err);
                respondError(res);
            } else {
                console.log(databaseLogPrefix + ".deleteObject(): object " + objectid + " was deleted. Got: " + update);
                respondSuccess(res, update);
            }
        });
    }

    function updateObject(collection, objectid, req, res, db) {
        console.log(databaseLogPrefix + ".updateObject(): " + objectid);

        // we read out the data from the request and then update the db with the data being passed
        var alldata = "";
        req.on("data", function (data) {
            alldata += data;
        });

        // we read out the data and then update the db with the data being passed
        req.on("end", function () {
            console.log(databaseLogPrefix + ".updateObject(): data is: " + alldata);
            // parse the data
            var parseddata = JSON.parse(alldata);
            // and update it to the collection - note that we can directly pass the data received to the update function
            collection.updateOne({
                _id: objectid
            }, {
                $set: parseddata
            }, function (err, updated) {
                db.close();
                if (err || !updated) {
                    console.error(databaseLogPrefix + ".updateObject(): object data could not be updated: " + err);
                    respondError(res);
                } else {
                    console.log(databaseLogPrefix + ".updateObject(): update done: " + updated);
                    // and respond
                    respondSuccess(res, updated);
                }
            })
        });
    }

    /*
     * multipart handling
     */
    /*
     * MFM: the method for handling multipart requests
     */
    function handleMultipartRequest(uri, req, res) {
        console.log(databaseLogPrefix + ".handleMultipartRequest(): " + uri);
        multipart.handleMultipartRequest(req, res, "./www/" + (tenant ? tenant.id + "/" : ""), "content/", function ondone(formdata) {
            console.log(databaseLogPrefix + ".handleMultipartRequest(): got formdata: " + JSON.stringify(formdata));
            respondMultipart(req, res, uri, formdata);
        });
    }

    /* MFM: function for responding the result of multipart request processing: we send a script that invokes an onMultipartResponse() callback */
    function respondMultipart(req, res, uri, content) {
        // check whether we shall create a script that is loaded into an iframe - this is the case if the multipart form request has been created by the browser, rather than by our own usage of FormData via XmHttpRequest
        if (content.createIframeCallback) {
            console.log(databaseLogPrefix + ".respondMultipart(): " + uri);
            var script = "<script language=\"javascript\" type=\"text/javascript\">var content = " + JSON.stringify(content) + "; window.top.window.vc.onMultipartResponse(\'" + uri + "\', content);</script>";
            res.writeHead(200, {
                'Content-Type': 'text/html'
            });
            res.write(script);
            res.end();
        } else {
            respondSuccess(res, content);
        }
    }

    /*
     * utility functions for sending success and error responses
     */
    function respondSuccess(res, json) {
        if (json) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            // we use a wrapper around the return value, which might be an object or (e.g. for update and delete) an integer
            res.write(JSON.stringify({
                data: json
            }));
        } else {
            res.writeHead(200);
        }

        res.end();
    }

    function respondError(res, code) {
        res.writeHead(code ? code : 500);
        // we foresee passing an object containing an error message
        res.write(JSON.stringify({
            message: "an error occurred"
        }));
        res.end();
    }

}