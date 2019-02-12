/*
 * originally taken from http://jmesnil.net/weblog/2010/11/24/html5-web-application-for-iphone-and-ipad-with-node-js/
 */

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');

// not used for the time being
//var tls = require('tls');

var utils = require("./njsimpl/njsutils");

var http2mdb = require("./njsimpl/http2mdb");

// the HTTP server
var server;
// the HTTPS server
var httpsServer;
// the port on which the server will be started
var port = 2424;
// the ip address
var ip = utils.getIPAddress();
// the segment for identifying the rest api
var apiref = "api";

/****************************************************************************
 * adaptable settings
 ****************************************************************************/
// set this variable to true for testing service workers and progressive webapp manifest without http on localhost
var localtest = false;
if (localtest) {
    ip = "127.0.0.1";
}

// settings for https
var httpsEnabled = false;
var localPassphrase = null;

// multitenant settings
var multitenantsEnabled = false;

if (multitenantsEnabled) {
    console.log("\nSERVER RUNNING IN MULTITENANTS MODE -- PLACE TENANTS' APPLICATIONS IN www/<tenant-id> DIRECTORIES AND EDIT njsimpl/tenants.json\n");
}

/****************************************************************************
 * the top level request processing logic including handling of multitenancy
 ****************************************************************************/
var application = function(req, res) {
    var path = url.parse(req.url).pathname;
    var origpath = path;

    // MULTITENANT: as the availability check currently does not use a relative url but accesses /available, we need to handle requests here
    if (path.indexOf("/available") == 0) {
        console.log(".onHttpRequest(): received an availability request, respond with success");
        res.writeHead(204);
        res.end();
    }
    else if (multitenantsEnabled && path == "/") {
        console.log(".onHttpRequest(): received a root request");
        res.writeHead(404);
        res.write("ERROR: this server expects requests to specify a tenant id.");
        res.end();
    }
    else if (multitenantsEnabled) {
        // MULTITENANT: cut the first segment of the path, which will be the tenant id
        var segments = path.split("/");
        var tenantId = segments[1];

        // lookup the tenant id in a config file, which also allows us to output user-specific logs without disclosing the tenant ids
        // note that currently we read the file for each request, which allows to do runtime updates
        fs.readFile(__dirname + "/njsimpl/tenants.json", function (err, data) {
            if (err) {
                res.writeHead(500);
                res.write("ERROR: The tenants configuration could not be found.");
                res.end();
            }
            else {
                // parse the file data and try to read out the tenant name
                var tenants = JSON.parse(data);
                var tenant = tenants[tenantId];

                // check whether we have found a tenant name
                if (!tenant) {
                    res.writeHead(404);
                    res.write("ERROR: Unknown tenant id: " + tenantId);
                    res.end();
                }
                else {
                    // we add the id to the object
                    tenant.id = tenantId;
                    tenant.origpath = origpath;

                    // as path we use the segments after the tenant id
                    path = utils.substringAfter(path, "/" + tenantId);
                    if (path == "") {
                        // root requests to tenant's applications need to put a "/" at the end, otherwise relative urls will not include the necessary segment for the tenant id
                        res.writeHead(400);
                        res.write("ERROR: root requests to tenants' application need to put a '/' at the end!");
                        res.end();
                    }
                    else {

                        if (!path.startsWith("/")) {
                            path = "/" + path;
                        }
                        // MULTITENANT: from here on, continue processing as before without multitenancy...
                        handleRequest(req,res,path,tenant);
                    }
                }
            }
        });
    }
    else {
        handleRequest(req,res,path);
    }

    // exception handling, see http://stackoverflow.com/questions/5999373/how-do-i-prevent-node-js-from-crashing-try-catch-doesnt-work
    process.on("uncaughtException", function (error) {
        console.log("onHttpRequest): got an uncaught exception!");
        console.log(error.stack);
        console.log(".onHttpRequest(): finishing response on error...");
        res.writeHead(500);
        res.end();
    });

    // don't limit the amount of event listeners
    process.setMaxListeners(0);

};

/***********************************************************************************
 * main request handling branching between api request and static resource requests
 ***********************************************************************************/
function handleRequest(req,res,path,tenant) {

    console.log((tenant ? tenant.name : "") + ".onHttpRequest(): trying to serve path: " + path);

    // check whether we have an api call or need to serve a file
    if (path.indexOf("/http2mdb/") == 0 && apiref != "http2mdb") {
        console.error((tenant ? tenant.name : "") + ".onHttpRequest(): ERROR: legacy api prefix http2mdb is being used, but prefix is set to: " + apiref + "!");
        res.writeHead(404);
        res.end();
    } else if (path.indexOf("/available") == 0) {
        console.log((tenant ? tenant.name : "") + ".onHttpRequest(): received an availability request, respond with success");
        res.writeHead(204);
        res.end();
    }
    else if (path.indexOf("/" + apiref + "/") == 0) {
        console.log((tenant ? tenant.name : "") + ".onHttpRequest(): got a call to the rest api. Will continue processing there...");

        // MULTITENANT: create a new instance of the api with the tenant name for each api request - this solution will survive, e.g., db restarts
        // note that we use the tenant name to also hide the tenant id at the level of the database (it is only passed for processing multipart requests)
        var tenantCRUDImpl = tenant ? new http2mdb.CRUDImpl(tenant) : new http2mdb.CRUDImpl();

        tenantCRUDImpl.processRequest(req, res, apiref);
    } else {
        if (path.length > 1 && path.indexOf("%7D%7D") == path.length - 6) {
            console.warn((tenant ? tenant.name : "") + ".onHttpRequest(): path seems to be a template filling expression. Will not deliver anything.");
            res.writeHead(204);
            res.end();
        }
        else {
            if (path == '/') {
                // if the root is accessed we serve the main html document
                path = "app.html";
            }
            else {
                // we need to consider that the path may be url encoded, e.g. in case a filename contains blanks
                path = decodeURI(path);
            }

            // here we distinguish between uploaded content and other static resources (in order to allow for a different implementation of serveStaticResource(), e.g. be accessing some external file server
            if (path.startsWith("/content")) {
                serveUploadedContent(req,res,path,tenant);
            }
            else {
                serveStaticResource(req,res,path,tenant);
            }
        }
    }
}

function serveUploadedContent(req,res,path,tenant) {
    console.log((tenant ? tenant.name : "") + ".onHttpRequest(): serve uploaded content: " + path);
    doServeStaticResource(req,res,path,tenant);
}

// MULTITENANT: provide an alternative implementation of this function if tenants' applications are not provided via the local filesystem, but, e.g., via an external file server
function serveStaticResource(req,res,path,tenant) {
    doServeStaticResource(req,res,path,tenant);
}

function doServeStaticResource(req,res,path,tenant) {
// serveable resources will be put in the webcontent directory -- the callback will be passed the data read out from the file being accessed
// MULTITENANT: we will serve the resources from the tenant's subdirectory within the www webspace or directly from there if multitenancy is not enabled
    fs.readFile(__dirname + "/www/" + (tenant ? tenant.id + "/" : "") + path, function (err, data) {
        // check whether we have got an error retrieving the resource: create a 404 error, assuming that a wrong uri was used
        if (err) {
            console.error((tenant ? tenant.name : "") + ".onHttpRequest(): ERROR: cannot find file: " + path);
            res.writeHead(404);
            res.write("ERROR: resource not found: " + (tenant ? tenant.origpath : path));
            res.end();
        }
        // otherwise create a 200 response and set the content type header
        else {
            res.writeHead(200, {
                'Content-Type': contentType(path)
            });
            res.write(data, 'utf8');
            res.end();
        }
    });
}


/***********************************************************************************
 * start the server
 ***********************************************************************************/
server = http.createServer(application);
// let the server listen on the given port
server.listen(port, ip);
console.log("HTTP server running at http://" + ip + ":" + port);

// providing https access (e.g. for testing service workers), following https://aghassi.github.io/ssl-using-express-4/
if (httpsEnabled) {

// this might no be the most elegant solution to avoid the event emitter error message..., see http://stackoverflow.com/questions/9768444/possible-eventemitter-memory-leak-detected
// here, we set the credentials
    var key = fs.readFileSync("njsimpl/https.key").toString();
    var cert = fs.readFileSync("njsimpl/https.cert").toString();

    if (!localPassphrase) {
        console.error("For serving the application via HTTPS you need to specify your local passphrase for accessing the SSL certificates! Use 'NONE' if no passphrase is required.");
        return;
    }

    var sslOptions = (localPassphrase == "NONE") ? {key: key, cert: cert} : {
        key: key,
        cert: cert,
        passphrase: localPassphrase
    };

    // the following way, i.e. creating a credentials object and passing it as sslOptions does not work! Will result in SSL_ERROR_NO_CYPHER_OVERLAP error when accessing application
    // var credentials = tls.createSecureContext(sslOptions);
    // console.log("created credentials: " + credentials);// + ", using key: " + key + ", cert: " + cert);
    httpsServer = https.createServer(sslOptions, application);

    var iphttps = ip;
    httpsServer.listen(port + 1, iphttps);
    console.log("HTTPS server running at https://" + iphttps + ":" + (port + 1));

}

/***********************************************************************************
 * helper method for contentType assignment based on file extension
 ***********************************************************************************/
function contentType(path) {
    if (path.match('.js$')) {
        return "text/javascript";
    } else if (path.match('.css$')) {
        return "text/css";
    } else if (path.match('.json$')) {
        return "application/json";
    } else if (path.match('.css$')) {
        return "text/css";
    } else if (path.match('.png$')) {
        return "image/png";
    } else if (path.match('.jpg$')) {
        return "image/jpeg";
    } else if (path.match('.jpeg$')) {
        return "image/jpeg";
    } else if (path.match('.ogv$')) {
        return "video/ogg";
    } else if (path.match('.ogg$')) {
        return "audio/ogg";
    } else if (path.match('.manifest$')) {
        return "text/cache-manifest";
    } else if (path.match('.webapp$')) {
        return "application/x-web-app-manifest+json";
    } else {
        return "text/html";
    }
}

