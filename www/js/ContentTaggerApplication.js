/**
 * Created by master on 17.02.16.
 */
import {mwf} from "./Main.js";
import {mwfUtils} from "./Main.js";
import {EntityManager} from "./Main.js";
import {GenericCRUDImplLocal} from "./Main.js";
import {GenericCRUDImplRemote} from "./Main.js";
import {entities} from "./Main.js";

class ContentTaggerApplication extends mwf.Application {

    constructor() {
        super();

        // the button for toggling the crudscope
        this.toggleCrudscopeButtons = [];
        this.initialCRUDScope = this.CRUDOPS.LOCAL;
    }


    async oncreate() {
        console.log("ContentTaggerApplication.oncreate(): calling supertype oncreate")

        // first call the supertype method and pass a callback
        await super.oncreate();
        console.log("ContentTaggerApplication.oncreate(): supertype oncreate done");

        this.toggleCrudscopeButtons = document.getElementsByClassName("cta-toggle-crudscope");
        console.log("ContentTaggerApplication.oncreate(): found " + this.toggleCrudscopeButtons.length + "  toogle-crudscope buttons");

        // here, we instantiate the data access components
        await GenericCRUDImplLocal.initialiseDB("mwfdb", 1, ["Tag", "Note", "Place"]);

        this.registerEntity("Tag", entities.Tag, true);
        this.registerCRUD("Tag", this.CRUDOPS.LOCAL, GenericCRUDImplLocal.newInstance("Tag"));
        this.registerCRUD("Tag", this.CRUDOPS.REMOTE, GenericCRUDImplRemote.newInstance("Tag"));

        this.registerEntity("Note", entities.Note, true);
        this.registerCRUD("Note", this.CRUDOPS.LOCAL, GenericCRUDImplLocal.newInstance("Note"));
        this.registerCRUD("Note", this.CRUDOPS.REMOTE, GenericCRUDImplRemote.newInstance("Note"));

        this.registerEntity("Place", entities.Place, true);
        this.registerCRUD("Place", this.CRUDOPS.LOCAL, GenericCRUDImplLocal.newInstance("Place"));
        this.registerCRUD("Place", this.CRUDOPS.REMOTE, GenericCRUDImplRemote.newInstance("Place"));

        // THIS WILL RESULT IN SETTING THE CRUD DECLARATIONS ON THE entity manager
        this.initialiseCRUD(this.initialCRUDScope,EntityManager);


        // THIS MUST NOT BE FORGOTTEN: initialise the entity manager!
        EntityManager.initialise();

        console.log("ContentTaggerApplication.oncreate(): done.");

        // include service workers
        // this.initialiseServiceWorkers();

    }

    initialiseCRUD(scope,em) {
        super.initialiseCRUD(scope,em);
        for (var i=0;i<this.toggleCrudscopeButtons.length;i++) {
            if (this.currentCRUDScope == this.CRUDOPS.REMOTE) {
                this.toggleCrudscopeButtons[i].classList.add("cta-crudscope-remote");
            }

            this.toggleCrudscopeButtons[i].onclick = (event) => {
                console.log("toggleCrudscope(): current scope is: " + this.currentCRUDScope);
                // toggle the class assignment on the button
                event.target.classList.toggle("cta-crudscope-remote");
                // toggle the value of the crudopsScope and
                if (this.currentCRUDScope == this.CRUDOPS.REMOTE) {
                    this.switchCRUD(this.CRUDOPS.LOCAL,em);
                }
                else {
                    this.switchCRUD(this.CRUDOPS.REMOTE,em);
                }

                this.notifyListeners(new mwf.Event("crud","changedScope"));
            };
        }
    }

    initialiseServiceWorkers() {
        console.log("initialiseServiceWorkers()");
        if ('serviceWorker' in navigator) {
            console.log("initialiseServiceWorkers(): adding event handler for messaging...");

            // here, we register for receiving messages from a worker
            navigator.serviceWorker.addEventListener("message", (event) => {
                console.log("received message from serviceWorker: " + event.data);
                // the event contains the port which we will use to return data to the event emitter
                event.ports[0].postMessage({data: this.handleServiceWorkerRequest(event.data)});
            });

            // it seems that service workers need to be physically placed at the root of its scope, otherwise there will be a security exception...
            navigator.serviceWorker.register("../OfflineCacheServiceWorker.js")
                .then(function(reg) {
                    // registration worked
                    console.log('Service Worker Registration succeeded. Scope is ' + reg.scope);
                }).catch(function(error) {
                // registration failed
                console.log('Service Worker Registration failed with ' + error);
                mwfUtils.showToast("Service Worker could not be registered!",1500);
            });

            // this will send a message to the worker
            if (navigator.serviceWorker.controller) {
                console.log("initialiseServiceWorkers(): let service worker cache resources if update is required...");
                navigator.serviceWorker.controller.postMessage({func: "cacheResources"});
            }
            else {
                console.log("initialiseServiceWorkers(): serviceWorker.controller is not available");
            }
        }
        else {
            mwfUtils.showToast("Service Workers are not supported by this browser. Offline cache will not be available.",1500);
        }
    }

    // this could be done with eval(), but we would need to do some string replacements for handling the linebreaks in offline.manifest
    handleServiceWorkerRequest(request) {
        console.log("handleServiceWorkerRequest(): " + request.func);
        if (request.func == "localStorage.getItem") {
            return localStorage.getItem(request.args[0]);
        }
        else if (request.func == "localStorage.setItem") {
            localStorage.setItem(request.args[0],request.args[1]);
            return;
        }
        else if (request.func == "alert") {
            alert(request.args[0]);
            return;
        }
        else if (request.func == "showToast") {
            mwfUtils.showToast(request.args[0]);
            return;
        }
        else {
            console.error("handleServiceWorkerRequest(): cannot handle: " + request.func);
        }
    }

}

const application = new ContentTaggerApplication();
export {application as default}
