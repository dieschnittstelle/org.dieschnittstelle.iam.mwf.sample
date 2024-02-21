/**
 * @author Jörn Kreutel
 */

console.log("loading module...");


// a prefix for the restapi
var apiprefix = "api";

/*
 * generic method for calling a webapp passing / receiving json and callback methods
 *
 * method: the http method to be executed
 * requestpath: the path to be appended to the root path of the webapp
 * obj: an (optional object to be passed)
 * onsucccess: callback in case of success
 * onerror: callback in case of error
 */
function xhr(method, requestpath, obj, onsuccess, onerror) {
    console.log("callWebapp()");

    // create the request
    var xmlhttp = new XMLHttpRequest();

    var url = null;

    if (requestpath) {

        if (requestpath.indexOf("/") == 0) {
            url = requestpath.substring(1);
        } else {
            url = requestpath;
        }

        /*
         * specify the callback function using our own callback function arguments - this code will be executed as soon as we have started sending the request
         */
        xmlhttp.onreadystatechange = function () {

            switch (xmlhttp.readyState) {
                case 4:
                    console.log("onreadstatechange: request finished and response is ready. Status is: " + xmlhttp.status);
                    // in case we have a request code of 200 OK, we execute the onsuccess function passed as an argument
                    if (xmlhttp.status == 200) {
                        // show how to access a response header
                        console.log("response Content-Type header is: " + xmlhttp.getResponseHeader("Content-type"));
                        console.log("responseType is: " + xmlhttp.responseType);
                        console.log("response is: " + xmlhttp.response);

                        if (onsuccess) {
                            // the function will be passed the request object to be free with regard to reading out its content
                            onsuccess(xmlhttp);
                        } else {
                            alert("request " + url + " executed successfully, but no onsuccess callback is specified.");
                        }
                    } else {
                        if (onerror) {
                            onerror(xmlhttp);
                        } else {
                            alert("got error processing request " + url + ", but no onerror callback is specified. Status code is: " + xmlhttp.status);
                        }
                    }
                    break;
                // we add log messages for the other status
                case 3:
                    console.log("onreadstatechange: processing response...");
                    break;
                case 2:
                    console.log("onreadstatechange: response received.");
                    break;
                case 1:
                    console.log("onreadstatechange: connection established.");
                    break;
                case 0:
                    console.log("onreadstatechange: request not initialised yet.");
                    break;
            }
        };

        /*
         * open a connection to the server
         */
        xmlhttp.open(method, url, true);

        /*
         * configure the request
         */

        // a variable that will hold json data that will be sent with the request
        var json;

        // set the proper header information along with the request
        if (obj) {
            // create a json representation from the object
            json = JSON.stringify(obj);
            // set the header that indicates what type of content we are sending
            xmlhttp.setRequestHeader("Content-type", "application/json");
        }

        // set the header indicating which content types we accept (quite coarse-grained, though)
        xmlhttp.setRequestHeader("Accept", "application/json, application/xml, text/html, text/plain");

        /*
         * send the request
         */

        // send the request and pass the json string as content or do not pass any content
        console.log("sending request...");
        if (obj) {
            xmlhttp.send(json);
        } else {
            xmlhttp.send();
        }
    } else {
        console.error("no requestpath specified! Ignore...");
    }
}

/*
 * a convenience function for executing crud operations via xhr, assuming that the server-side api uses a wrapper object with the actual response data accessible via the data attribute
 * note that in case of a 404 status code, we call the onsuccess function without an argument!
 * we also prefix the rest api path prefix
 *
 * note that this function is not exported by the module but partially bound by the exported functions create, read, update and delete
 */
function crud(httpmethod, resource, data, onsuccess) {
    xhr(httpmethod, apiprefix + resource, data, function (xmlhttp) {
        // some checks on content-type would make this more robust
        var responseobj = JSON.parse(xmlhttp.responseText);
        if (!responseobj.data) {
            alert("got call to crud using method " + httpmethod + ", but response does is not compliant with the expected format (wrapper object with data attribute): " + JSON.stringify(responseobj));
        } else {
            onsuccess(responseobj.data);
        }
    }, function (xmlhttp) {
        if (xmlhttp.status == 404) {
            console.log("got 404 status code for " + httpmethod + " crud call on " + resource + ". Will call onsuccess without argument");
            onsuccess();
        } else {
            alert("got error status code " + xmlhttp.status + " for " + httpmethod + " crud call on " + resource + ". responseText is " + xmlhttp.responseText);
        }
    });
}

function setApiprefix(prefix) {
    apiprefix = prefix;
}

function getApiprefix() {
    return apiprefix;
}

// export the functions - note that the misspelling of delete is intended for avoiding errors reported by javascript editors due to usage of a reserved keyword...
const create = crud.bind(undefined, "POST");
const read = crud.bind(undefined, "GET");
const update =  crud.bind(undefined, "PUT");
const deleat = crud.bind(undefined, "DELETE");

export {
    xhr,
    setApiprefix,
    getApiprefix,
    create,
    read,
    update,
    deleat
};
