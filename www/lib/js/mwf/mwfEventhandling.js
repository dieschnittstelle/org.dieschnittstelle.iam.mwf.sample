/**
 * @author Jörn Kreutel
 */

// some components for custom event handling, used for minimising dependencies between different controllers of a composite view

console.log("loading module...");

/*
 * some custom event class
 */
function CustomEvent(group, type, target, data) {
    this.group = group;
    this.type = type;
    this.target = target;
    if (data) {
        this.data = data;
    }
}

// declare some id function on CustomEvent (see for a non standard alternative: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/__defineGetter__)
CustomEvent.prototype.desc = function () {
    return (this.group || "") + "_" + (this.type || "") + "_" + (this.target || "");
};

/*
 * some class that can be used for collecting event handlers and dispatching events, we call it eventdispatcher for the time being
 */
function EventDispatcher() {

    /*
     * these functions are used for removing dependencies between the single components in favour of a central event handling
     */
    var eventListeners = {};

    // events will be characterised by the three string valued properties group (ui, crud, etc.), type, and target
    // we allow to specify additional parameters (when the dispatcher is used by view controllers, the parameter runOnPaused may be passed as part of params
    this.addListener = function (event, callback, owner, params) {

        // check if an owner is specified and set it on the callback function for our own purposes
        if (owner) {
            callback.eventHandlerOwner = owner;
        }

        if (params) {
            callback.eventHandlerParams = params;
        }

        // check whether the event type contains a "|" symbol that identifies more than a single event
        if (event.type.indexOf("|") != -1) {
            console.log("event specifies a disjunction of types: " + event.type + ". Will add a listener for each concrete type");
            var etypes = event.type.split("|");
            var i;
            for (i = 0; i < etypes.length; i++) {
                this.addListener(new CustomEvent(event.group, etypes[i], event.target), callback);
            }
        } else {
            console.log("adding new event listener for event " + event.desc());
            if (eventListeners[event.desc()]) {
                console.log("adding listener to existing listeners.");
                eventListeners[event.desc()].push(callback);
            } else {
                console.log("creating new event listener list.");
                eventListeners[event.desc()] = [callback];
            }
        }
    };

    this.notifyListeners = function (event) {
        var els = eventListeners[event.desc()];
        if (els) {
            console.log("will notify " + (els ? els.length + " " : "0 ") + " listeners of event: " + event.desc());
            var i, currentCallback, boundHandler;
            for (i = 0; i < els.length; i++) {
                currentCallback = els[i];
                // check whether the callback has an owner, in which case it is up to the caller to handle the callback
                if (currentCallback.eventHandlerOwner) {
                    console.log("will pass bound listener " + i + " to owner");
                    // we pass owner, but the function should already be bound to it
                    boundHandler = currentCallback.bind(currentCallback.eventHandlerOwner, event);
                    // we set the event on the handler which will allow handlers to check whether the event
                    // is still valid or not
                    boundHandler.boundEvent = event;
                    if (currentCallback.eventHandlerParams) {
                        boundHandler.eventHandlerParams = currentCallback.eventHandlerParams;
                    }
                    currentCallback.eventHandlerOwner.runEventListener(boundHandler);
                }
                else {
                    // otherwise we directly call the callback
                    console.log("invoking listener " + i);
                    els[i](event);
                }
            }
        }
    };

    /*
     * this removes all listeners that have been registered for some owner
     */
    this.removeListenersForOwner = function (owner) {
        console.log("removing listeners for owner: " + owner + (owner.root ? (" " + owner.root.id) : ""));

        var evt, currentListeners, counter;
        for (evt in eventListeners) {
            currentListeners = eventListeners[evt];
            counter = 0;
            while (counter < currentListeners.length) {
                if (currentListeners[counter].eventHandlerOwner == owner) {
                    console.log("removing listener for event: " + evt);
                    currentListeners.splice(counter, 1);
                }
                else {
                    counter++;
                }
            }
        }
    };
}

// export the CustomEvent and EventDispatcher APIs
// export the functions

// we create the dispatcher as an enclosed singleton and expose its functions
const dispatcher = new EventDispatcher();
const addListener = dispatcher.addListener;
const notifyListeners = dispatcher.notifyListeners;
const removeListenersForOwner = dispatcher.removeListenersForOwner;

export {
    CustomEvent as Event,
    addListener,
    notifyListeners,
    removeListenersForOwner
};
