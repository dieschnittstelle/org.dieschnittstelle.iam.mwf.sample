/**
 * @author Jörn Kreutel
 */
/*
* initialise the access to the mdb
*/
// access the db
var databaseUrl = "mme2db";

// initialise the db using the mdbjs javascript api (here, we do not specify which collection to access as this is up to the user of this api)
var db = require("mdbjs").connect(databaseUrl);

// use our own utility functions
var utils = require("./njsutils");

/* MFM: import the components required for multipart request ("file upload") processing
 the class must be imported like this, otherwise its instances will not keep their state */
var MultipartReader = require("./multipart").MultipartReader;
var multipart = require("./multipart");

console.log("got db: " + db);

/*
 * an object type that represents the information contained in a uri and provides it via the attributes collection, objectid and furtherpath (the latter will not be used here)
 */
function MDBRequest(uri) {

    var segments = uri.split("/");
    console.log("MDBRequest(): segments are: " + segments)

    if (segments.length > 0 && segments[0].length > 0) {
        this.collection = segments[0];
        console.log("MDBRequest.collection: " + this.collection);
    }
    if (segments.length > 1 && segments[1].length > 0) {
        try {
            this.objectid = require("mdbjs").ObjectId(segments[1]);
        } catch (exception) {
            console.log("got exception: " + exception + ". This might be due to using an _id that has been assigned remotely: " + segments[1]);
            this.objectid = segments[1];//parseInt(segments[1]);
        }
        console.log("MDBRequest.objectid: " + this.objectid);
    }
    if (segments.length > 2 && segments[2].length > 0) {
        this.furtherpath = segments[2];
        console.log("MDBRequest.furtherpath: " + this.furtherpath);
    }

}

/*
 * we export the processRequest method that will be passed the request and response object and will dispatch to local methods depending on the type of request
 */
module.exports = {

    /* this method dispatches request depending on the request method, comparable to the servlet api */
    processRequest : function processRequest(req, res) {

        console.log("processRequest(): req: " + req);
        console.log("processRequest(): req.method: " + req.method);
        console.log("processRequest(): req.url: " + req.url);
        console.log("processRequest(): req header user-agent: " + req.headers["user-agent"]);
        console.log("processRequest(): req header host: " + req.headers["host"]);

        // we truncate the url
        var uri = utils.substringAfter(req.url, "/http2mdb/");

        // we assume the rest of the url specifies the collection and possibly object to be accessed and wrap this information in a special type of object
        var mdbrequest = new MDBRequest(uri);

        // load the collection
        var collection = db.collection(mdbrequest.collection);

        if (collection) {
            if (req.method == "GET") {
                if (mdbrequest.objectid) {
                    readObject(collection, mdbrequest.objectid, req, res);
                } else {
                    readAllObjects(collection, req, res);
                }
            } else if (req.method == "POST") {
                // MFM: check whether we have a multipart request
                if (utils.startsWith(req.headers["content-type"], "multipart/form-data;")) {
                    handleMultipartRequest(uri, req, res);
                }
                else {
                    createObject(collection, req, res);
                }
            } else if (req.method == "PUT") {
                updateObject(collection, mdbrequest.objectid, req, res);
            } else if (req.method == "DELETE") {
                deleteObject(collection, mdbrequest.objectid, req, res);
            } else {
                console.error("cannot handle request method: " + req.method);
                res.writeHead(405);
                res.end();
            }
        } else {
            console.error("request does not seem to specifiy a collection: " + uri + "!");
            res.writeHead(400);
            res.end();
        }
    }
}

/*
 * read a single object
 */
function readObject(collection, objectid, req, res) {
    console.log("readObject(): " + objectid);

    collection.find({
        _id : objectid
    }, function(err, elements) {
        if (err || !elements) {
            console.log("Error accessing collection! " + err ? err : "");
            respondError(res);
        } else if (elements.length == 0) {
            console.error("the element with id " + objectid + " could be found inside of the collection.");
            respondError(res, 404);
        } else {
            console.log("readObject(): found " + elements.length + " elements.");
            respondSuccess(res, elements[0]);
        }
    });
}

function readAllObjects(collection, req, res) {
    console.log("readAllObjects()");

    collection.find(function(err, elements) {
        if (err || !elements) {
            console.log("Error accessing collection: " + err + "!");
            respondError(res);
        } else {
            console.log("readAllObjects(): found " + elements.length + " elements.");
            respondSuccess(res, elements);
        }
    });
}

function createObject(collection, req, res) {
    console.log("createObject()");

    // we read out the data from the request and then update the db with the data being passed
    var alldata = "";
    req.on("data", function(data) {
        alldata += data;
    });

    // with .on() for "data" we read out the request body - we will get it passed via the callback function
    // note that here we have a callback inside of a callback!
    req.on("end", function() {
        console.log("createObject(): data is: " + alldata);
        // parse the data
        var parseddata = JSON.parse(alldata);
        // and save it to the collection
        collection.save(parseddata, function(err, saved) {
            if (err || !saved) {
                console.error("object data could not be saved: " + err);
                respondError(res);
            } else {
                console.log("createObject(): saved object is: " + JSON.stringify(saved));
                // and respond
                respondSuccess(res, saved);
            }
        })
    });
}

function deleteObject(collection, objectid, req, res) {
    console.log("deleteObject(): " + objectid);

    collection.remove({
        _id : objectid
    }, function(err, update) {
        if (err || !update) {
            console.log("object " + objectid + " could not be deleted. Got: " + err);
            respondError(res);
        } else {
            console.log("object " + objectid + " was deleted. Got: " + update);
            respondSuccess(res, update);
        }
    });
}

function updateObject(collection, objectid, req, res) {
    console.log("updateObject(): " + objectid);

    // we read out the data from the request and then update the db with the data being passed
    var alldata = "";
    req.on("data", function(data) {
        alldata += data;
    });

    // we read out the data and then update the db with the data being passed
    req.on("end", function() {
        console.log("updateObject(): data is: " + alldata);
        // parse the data
        var parseddata = JSON.parse(alldata);
        // and update it to the collection - note that we can directly pass the data received to the update function
        collection.update({
            _id : objectid
        }, {
            $set : parseddata
        }, function(err, updated) {
            if (err || !updated) {
                console.error("object data could not be updated: " + err);
                respondError(res);
            } else {
                console.log("updateObject(): update done: " + updated);
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
    console.log("handleMultipartRequest(): " + uri);
    multipart.handleMultipartRequest(req, res, "./www/", "content/", function ondone(formdata) {
        console.log("got formdata: " + JSON.stringify(formdata));
        respondMultipart(req, res, uri, formdata);
    });
}

/* MFM: function for responding the result of multipart request processing: we send a script that invokes an onMultipartResponse() callback */
function respondMultipart(req, res, uri, content) {
    // check whether we shall create a script that is loaded into an iframe - this is the case if the multipart form request has been created by the browser, rather than by our own usage of FormData via XmHttpRequest
    if (content.createIframeCallback) {
        console.log("respondMultipart(): " + uri);
        var script = "<script language=\"javascript\" type=\"text/javascript\">var content = " + JSON.stringify(content) + "; window.top.window.vc.onMultipartResponse(\'" + uri + "\', content);</script>";
        res.writeHead(200, {
            'Content-Type' : 'text/html'
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
            'Content-Type' : 'application/json'
        });
        // we use a wrapper around the return value, which might be an object or (e.g. for update and delete) an integer
        res.write(JSON.stringify({
            data : json
        }));
    } else {
        res.writeHead(200);
    }

    res.end();
}

function respondError(res, code) {
    res.writeHead( code ? code : 500);
    // we foresee passing an object containing an error message
    res.write(JSON.stringify({
        message : "an error occurred"
    }));
    res.end();
}
