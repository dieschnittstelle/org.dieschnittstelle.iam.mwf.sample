/**
 * Created by master on 24.02.17.
 */


// the version - note that a new version will only be active once there are no active pages loaded that use the old version. Refreshing the browser window does not seem to trigger reloading. Tab needs to be closed and reopened
this.version = "v16";

// a message channel which we use for communicating with the application that is using this worker
this.messageChannel = new MessageChannel();

// for debugging workers, see: about:debugging - however, it seems that firefox needs to be restarted if since the last start the worker has been updated
// for more: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

// track whether we are currently caching or not
this.caching = false;

// install
this.addEventListener("install", function (event) {
    console.log(this.version + ".install(): service worker " + this.version + " is being installed...");

    // we will load the manifest as triggered by a message from the application, not here
    // TODO: currently, caching will only be done on the second access as before the event messaging channel between application and worker has not yet been established
});

// fetch
this.addEventListener("fetch", function (event) {

    event.respondWith(
        caches.match(event.request).then(function (response) {
            console.log(this.version + ".fetch(): got content from cache for " + event.request.url + ": " + response);
            return response || fetch(event.request);
        })
    );

});

// react to client-initiated messages
this.addEventListener("message", function (event) {
    console.log("onMessage(): " + event.data.func);
    if (event.data.func == "cacheResources") {
        cacheResources();
    }
    else {
        console.error("onMessage(): cannot handle client request. Unknown function: " + event.data.func);
    }
});


function cacheResources() {
    console.log(this.version + ".cacheResources(): will cache resources...");

    caches.open('v1').then(function (cache) {
        // TODO: if the manifest cannot be accessed it currently looks as if the request hangs, the application can be used, though - see discusions on introducing timeout parameter for fetch()
        fetch("offline.manifest").then(function (response) {
            if (response.status == 200) {
                console.log(this.version + ".cacheResources(): offline cache manifest was loaded");
                response.text().then(function (responseText) {
                    console.log(this.version + ".cacheResources(): trying to access manifest in local storage...");

                    // we send a message indicating that we want to access the localStorage
                    sendMessageForResponse({func: "localStorage.getItem", args: ["currentManifest"]}).then(response => {
                        // the response.data attribute will contain the manifest
                        var currentManifest = response.data;
                        // console.log(this.version + ".cacheResources(): received currentManifest: " + currentManifest);
                        if (currentManifest == responseText) {
                            console.log(this.version + ".cacheResources(): manifest has not changed since previous access. Ignore.");
                            return;
                        }
                        else {
                            console.log(this.version + ".cacheResources(): manifest has changed since previous access. Reload.");
                        }

                        var cachedResources = parseManifest(responseText);
                        console.log(this.version + ".cacheResources(): got " + cachedResources.length + " cached resources");

                        // we set an error listener on the cache object
                        cache.onerror = function (event) {
                            console.log("got exception on cache: " + cache);
                        }

                        // we add the resources to the cache
                        cache.addAll(cachedResources).then(e => {
                            console.log(this.version + ".cacheResources(): all resources have been cached. Will update manifest in local storage.");
                            // we will send the new manifest back to the application without waiting for the result, though
                            sendMessageForResponse({func: "localStorage.setItem", args: ["currentManifest", responseText]});
                            sendMessageForResponse({func: "showToast", args: [cachedResources.length + " cache entries have been updated successfully."]});
                        }).catch(e => {
                            console.log("error on addAll(): " + e);
                            // we will send the new manifest back to the application without waiting for the result, though
                            sendMessageForResponse({func: "alert", args: ["Error on updating cache. Check your offline.manifest entries! Error is: " + e]});
                        });
                    });
                });
            }
            else {
                console.log(this.version + ".cacheResources(): offline cache cannot be loaded. Got  status: " + response.status + " . Maybe we are offline");
            }
        });
    }).catch(error => console.error(this.version + ".cacheResources(): offline cache cannot be loaded. Got error: " + error));
}


function parseManifest(manifest) {
    // we cannot access window.location, but the scope of the worker is available
    console.log(this.version + ".parseManifest(): using baseUrl from self.registration.scope: " + self.registration.scope);

    // we go through the manifest, reading each line
    var lines = manifest.split("\n");
    console.log(this.version + ".parseManifest(): read " + lines.length + " lines.");

    // this variable controls whether we shall add a line to the cache
    var addToCache = true;
    // we add the root entry (which will be responded to with app.html)
    var cacheEntries = [self.registration.scope];

    // consider the cache syntax
    lines.forEach(function (l) {
        if (l.startsWith("CACHE MANIFEST") || l.startsWith("#") || l == "") {
            // ignore line
        }
        else if (l.startsWith("NETWORK:")) {
            addToCache = false;
        }
        else if (l.startsWith("FALLBACK:")) {
            addToCache = false;
        }
        else if (l.startsWith("CACHE:")) {
            addToCache = true;
        }
        else if (addToCache) {
            cacheEntries.push(self.registration.scope + ((!l.startsWith("/") && !self.registration.scope.endsWith("/")) ? "/" : "") + l);
        }
    });
    console.log(this.version + ".parseManifest(): got " + cacheEntries.length + " cache entries");
    return cacheEntries;
}

// messaging example taken from http://craig-russell.co.uk/2016/01/29/service-worker-messaging.html
// this is worker-initiated communication using a messagechannel and reacting to a response
function sendMessageForResponse(msg) {
    console.log(this.version + ".sendMessageForResponse(): " + msg);

    return new Promise(function (resolve, reject) {
        // this message sends an outgoing message and passes the
        clients.matchAll().then(clients => {
            clients.forEach(client => {
                console.log(this.version + ".sendMessageForResponse(): sending message to client: " + client);
                sendMessageToClient(client, msg).then(response => {
                    console.log(this.version + ".sendMessageForResponse(): received: " + response);
                    resolve(response)
                }).catch(err => {
                    if (reject) {
                        reject(err)
                    } else {
                        console.error(this.version + ".sendMessageForResponse(): error: " + err);
                    }
                });
            })
        })
    });
}

// this is a convenience function that wraps sending a message and receiving its response, taken from http://craig-russell.co.uk/2016/01/29/service-worker-messaging.html
function sendMessageToClient(client, msg) {
    return new Promise(function (resolve, reject) {
        var channel = new MessageChannel();

        channel.port1.onmessage = function (event) {
            if (event.data.error) {
                reject(event.data.error);
            } else {
                resolve(event.data);
            }
        };

        console.log("actually posting the message...");
        client.postMessage(msg, [channel.port2]);
    });
}
