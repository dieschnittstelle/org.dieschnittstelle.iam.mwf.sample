/**
 * @author Jörn Kreutel
 */
// this is the root object of the runtime execution

// TODO: reset viewcontroller stack on mainMenu action!? or alternatively allow resuming a "thread" by retrieving an active controller based on the selection id
// TODO: identify listviews by data-mwf-id rather than by id?
// TODO: allow to switch off mwf.stringify() for performance optimisation!

import {mwfUtils} from "../framework-modules.js";
import {eventhandling} from "../framework-modules.js";
import {EntityManager} from "../framework-modules.js";
import * as thisapp from "../../../js/Main.js";

console.log("loading module...");

var applicationState, applicationResources, applicationObj;

// constants for lifecycle functions
var CONSTANTS = {
    // lifycycle constants
    LIFECYCLE: {
        CONSTRUCTED: "CONSTRUCTED",
        CREATED: "CREATED",
        SHOWING: "SHOWING",
        PAUSED: "PAUSED",
        STOPPED: "STOPPED",
        // introduce obslete status, which will result in skipping resume when returning to some view controller
        OBSOLETE: "OBSOLETE"
    }
};

// some global storage
var GLOBAL = {};

/* local utility functions */

function cancelClickPropagation(e) {
    if (e.eventPhase != Event.CAPTURING_PHASE) {
        e.stopPropagation();
        // we also need to cancel the immediate propagation
        e.stopImmediatePropagation();
    }
}

function handleAutofocus(element) {
    var autofocus = element.querySelector(".mwf-autofocus");
    if (autofocus) {
        console.log("focus on: " + autofocus);
        autofocus.focus();
    }
}

function getDialogId(dialog) {
    // the dialogId is either the id or the data-mwf-templatename
    return dialog.id || dialog.getAttribute("data-mwf-templatename");
}

/* this is for hiding all menus and dialogs before popping new ones */
function hideMenusAndDialogs() {
    console.log("hideMenusAndDialogs(): " + this.parent);

    var actionmenu;
    // check whether the parent has an actionmenu and close it - this only applies to an EmbeddedViewController
    if (this.parent && this.parent.getElementsByClassName) {
        actionmenu = this.parent.getElementsByClassName("mwf-actionmenu");
        if (actionmenu.length > 0) {
            actionmenu[0].classList.remove("mwf-expanded");
        }
    }

    // hide a local actionmenu
    actionmenu = this.root.getElementsByClassName("mwf-actionmenu");
    if (actionmenu.length > 0) {
        actionmenu[0].classList.remove("mwf-expanded");
    }

    // REFACVIEWS
    var dialog = document.querySelector(".mwf-dialog.mwf-shown");
    console.log("hideMenusAndDialogs(): dialog is: " + dialog);
    if (dialog) {


        var dialogid = getDialogId(dialog);
        // check whether the dialog has an embedded controller
        var dialogCtrl = applicationState.getEmbeddedController(dialogid);
        if (dialogCtrl) {
            console.log("hideMenusAndDialogs(): open dialog " + dialogid + " uses an own controller. Invoke hideDialog() on the controller...");
            dialogCtrl.hideDialog();
        }
        else {
            // REFACVIEWS:
            console.log("hideMenusAndDialogs(): open dialog " + dialogid + " does not use a controller. Just change styling...");
            dialog.classList.remove("mwf-shown");
            dialog.classList.add("mwf-hidden");
            dialog.onclick = null;
            console.log("REFACVIEWS: adding transitionend for hiding menus and dialogs: ", this.dialog);
            addRemoveOnFadedToElement(dialog);
        }
    }

    console.log("hideMenusAndDialogs(): root is: " + this.root.id);
    this.root.classList.remove("mwf-dialog-shown");

    // hide sidemenu - note that the sidemenu is looked up at document level
    var sidemenu = document.getElementsByClassName("mwf-sidemenu");
    if (sidemenu.length > 0) {
        sidemenu[0].classList.remove("mwf-expanded");
    }
}

// we need the possibility to realise removing from outside, so we need to keep track of a map of listeners
const removeOnFadedListenerMap = new Map();

function trackRemoveOnFadedListenerForElement(el,listener) {
    removeOnFadedListenerMap.set(el,listener);
}

function getRemoveOnFadedListenerForElement(el,listener) {
    return removeOnFadedListenerMap.get(el);
}

function addRemoveOnFadedToElement(el) {
    if (el) {
        console.debug("REFACVIEWS: addRemoveOnFadedToElement(): ", el);
        // we remove the view on transitionend
        const removeOnFaded = () => {
            el.removeEventListener("transitionend",removeOnFaded);
            if (el.parentNode) {
                console.log("REFACVIEWS: transitionend(): remove element from parent: ",el);
                el.parentNode.removeChild(el);
            }
            else {
                console.log("REFACVIEWS: transitionend(): remove element from parent not possible as parent has not been set");
            }
        }
        el.addEventListener("transitionend",removeOnFaded);
        trackRemoveOnFadedListenerForElement(el,removeOnFaded);
    }
}

function removeRemoveOnFadedFromElement(el) {
    const removeOnFadedListener = getRemoveOnFadedListenerForElement(el);
    if (removeOnFadedListener) {
        console.info("REFACVIEWS: removeRemoveOnFadedFromElement(): remove transitionend listener from element without listener having been run (which will be the case if a view is obsolete):", el);
        el.removeEventListener("transitionend",removeOnFadedListener);
    }
    else {
        console.warn("REFACVIEWS: removeRemoveOnFadedFromElement(): no transitionend listener specified on element. Clarify why function has been called.", el);
    }
}

// this is used for touch-enabling elements. Note that event listeners are not copied when templates are cloned!
function touchEnableOffspring(node) {
    console.log("touch-enabled offspring of: " + node);
    // we touch-enable elements by default or on demand
    var touchEnabled = node.querySelectorAll("input[type=submit], button, .mwf-imgbutton, .mwf-touchfeedback, .mwf-menu-item");
    console.log("found " + touchEnabled.length + " touch-enabled elements");
    var i;
    for (i = 0; i < touchEnabled.length; i++) {
        console.log("touch-enable element: " + touchEnabled[i] + ", with classes: " + touchEnabled[i].getAttribute("class"));
        mwfUtils.feedbackTouchOnElement(touchEnabled[i]);
    }
}

/*
 * utility function used for all listview methods
 */
function getListviewAdapter(listviewid) {

    console.log("getListviewAdapter(): " + listviewid);

    if (arguments.length == 0 || !listviewid) {
        if (Object.keys(this.listviewAdapters).length == 1) {
            return this.listviewAdapters[Object.keys(this.listviewAdapters)[0]];
        }
        else {
            console.error("getListview(): cannot use default for listview. Either no or multiple listviews exist in view " + this.root.id);
        }
    }
    else {
        var listview = this.listviewAdapters[listviewid];
        if (listview) {
            return listview;
        } else {
            console.error("getListview(): listview wih id " + listviewid + " does not seem to exist in view " + this.root.id);
        }
    }

    return null;
}

/* end utility functions */

/*
 * encapsulare the template engine underneath of these functions - this is executed synchronically
 */
function TemplateProxy(ractive) {

    this.update = function(update) {
        ractive.set(update);
    };

    this.bindAction = function(actionname,actiondef) {
        ractive.on(actionname,actiondef);
    };

    this.observe = function(path,onchange) {
        return ractive.observe(path,onchange);
    };

}

function applyDatabinding(root, body, data) {
    // TODO: there is an issue that for template-wrapping divs, the empty div itself might be attached again to the root
    console.log("applyDatabinding(): using template body and root children: " + body, root.children.length);
    var ractive = new Ractive({
        el: root,
        template: body,
        data: data
    });
    console.log("applyDatabinding(): after template application children of root are ", root.children.length, root);
    // we add the ractive object as a handle to the root in order to do updates
    root.viewProxy = new TemplateProxy(ractive);
    touchEnableOffspring(root);
    console.log("applyDatabinding(): after touch enablement, children of root are ", root.children.length, root);
}

function ApplicationState() {
    console.log("ApplicationState()");

    // the list of view controllers that is currently active and is managed by the application stack
    var activeViewControllers = [];

    // the map of embedded view controllers that is not managed by the navigation stack (currently this is used for the sidemenu) - they are singletons and will be managed as a map, where keys are the ids of their view elements!
    // embedded controllers dealt with at application state level will be notified once navigation stack manipulation occurs in order to allow (re-)attachment to a new view (also this is used for the sidemenu vc)
    var embeddedViewControllers = {};

    function reattachEmbeddedControllers(vc) {
        console.log("reattachEmbeddedControllers()");

        var ctrlid, ctrl;
        for (ctrlid in embeddedViewControllers) {
            ctrl = embeddedViewControllers[ctrlid];
            if (ctrl.mwfAttaching) {
                console.log("attaching/detaching embeddable view controller: " + ctrlid);
                ctrl.detachFromView();
                ctrl.attachToView(vc.root);
            }
            else {
                console.log("embeddable view controller is not attaching: " + ctrl);
            }
        }
    }

    // push a view controller to the list of active controllers
    this.pushViewController = function (vc) {
        console.log("pushing view controller: " + vc + " onto list of " + activeViewControllers.length + " active controllers...");
        // we invoke pause on the current last element
        if (activeViewControllers.length != 0) {
            var currentViewVC = activeViewControllers[activeViewControllers.length - 1];
            console.log("pausing view controller: " + currentViewVC);

            // while oncreate is running on the new view controller the current view is still visible. Only once oncreate is finished we will exchange the views
            activeViewControllers.push(vc);

            vc.oncreate().then(function () {
                // we attach the embedded controllers once creation is done
                reattachEmbeddedControllers(vc);
                currentViewVC.onpause().then(function () {
                    vc.onresume().then(function () {
                    });
                });
            });

        } else {
            reattachEmbeddedControllers(vc);

            activeViewControllers.push(vc);
            vc.oncreate().then(function () {
                vc.onresume().then(function () {
                });
            });
        }
    };
    // remove the active view controller
    this.popViewController = function (returnData, returnStatus) {
        var vc = activeViewControllers.pop();
        console.log("REFACVIEWS: popViewController(): " + vc.root.id + ". Will call onpause+onstop", vc);
        // we first pause and then stop
        vc.onpause().then(function () {
            // we invoke the onstop method on the vc
            vc.onstop().then(function () {
                // then we check whether we have a current view controller and invoke onresume(); - unless it is obsolete
                if (activeViewControllers.length != 0) {
                    var currentViewVC = activeViewControllers[activeViewControllers.length - 1];

                    if (currentViewVC.lcstatus == CONSTANTS.LIFECYCLE.OBSOLETE) {
                        console.info("current view controller " + currentViewVC.root.id + " is obsolete. Pop it...");
                        // we do not pass returnData or status
                        this.popViewController({obsoleted: true},-1);
                    } else {
                        // here, we reattach the embedded controllers
                        reattachEmbeddedControllers(currentViewVC);

                        // TODO: we need to foresee the possibility that onReturnFromNextView cancels the resumption of the current view
                        // (e.g. when the view shall be skipped (e.g. readview after item deletion)
                        if (currentViewVC.onReturnFromNextView) {
                            currentViewVC.onReturnFromNextView(vc.root.id, returnData, returnStatus).then(function (goahead) {
                                if (goahead != false) {
                                    console.log("REFACVIEWS: onReturnFromNextView(): continuing regularly " + currentViewVC.root.id);
                                    currentViewVC.onresume().then(function () {
                                    });
                                }
                                else {
                                    console.info("REFACVIEWS: onReturnFromNextView(): won't continue display of currentview " + currentViewVC.root.id + ". Continuation is blocked.");
                                    removeRemoveOnFadedFromElement(currentViewVC.root);
                                }
                            });
                        } else {
                            currentViewVC.onresume().then(function () {
                            });
                        }
                    }
                }
            }.bind(this));
        }.bind(this));
    };

    this.clearControllers = function (callback) {
        var countdown = parseInt(activeViewControllers.length,10);
        var totalCount = parseInt(activeViewControllers.length,10);
        console.log("clearControllers(): countdown is: " + countdown);

        for (var i = 0; i < totalCount; i++) {
            let vc = activeViewControllers.pop();
            console.log("clearControllers(): popped vc " + vc.root.id);
            if (vc) {
                console.log("clearControllers(): popped view controller: " + vc.root.id + ". Will call onstop");
                vc.onstop().then(function () {
                    // if we are still attached, we need to remove ourselves (but without animation) - this occurs if onstop() is called from clearControllers
                    if (vc.root && vc.root.parentNode) {
                        console.log("clearControllers(): after onstop(), will remove view from dom: " + vc.root.id);
                        vc.root.parentNode.removeChild(vc.root);
                    }
                    else {
                        console.log("clearControllers(): after onstop(), view is not attached to a parent: " + vc.root.id);
                    }

                    countdown--;
                    if (countdown == 0) {
                        console.log("clearControllers(): no active view controllers left. Now call the callback from " + vc.root.id);
                        callback.call(this, vc.root.id);
                    }
                    else {
                        console.log("clearControllers(): countdown is greaterorequal than one: " + countdown);
                    }
                }.bind(this));
            }
            else {
                console.log("no vc can be found!");
            }
        }
    };

    this.addEmbeddedController = function (vc) {
        console.log("adding top level embedded view controller: " + JSON.stringify(vc));

        // check whether an id is specified, otherwise use the data-mwf-templatename as identifier
        if (vc.root.id) {
            embeddedViewControllers[vc.root.id] = vc;
        }
        else if (vc.root.hasAttribute("data-mwf-templatename")) {
            embeddedViewControllers[vc.root.getAttribute("data-mwf-templatename")] = vc;
        }
        else {
            console.error("addEmbeddedController(): embedded controller neither specifies an id, nor a data-mwf-templatename. How shall it be identified?");
        }
    };

    this.getEmbeddedController = function(ctrlid) {
        return embeddedViewControllers[ctrlid];
    };

    this.countControllers = function() {
        return activeViewControllers.length;
    }

}

/*
 *  a class that allows to represent reusable resources used by the application - for the time being we use this for markup templates
 */
function ApplicationResources() {

    /* the templates */
    var templates = {};

    /* on initialising, we read out all templates from the document, remove them from their location in the dom and store them in the templates variable */

    /* note that reading out the template elements and removing them needs to be done in two steps */
    this.extractTemplates = function() {
        var templateels = document.getElementsByClassName("mwf-template");
        console.log("found " + templateels.length + " templates");
        var i, currentTemplate, templatename;
        for (i = 0; i < templateels.length; i++) {
            currentTemplate = templateels[i];
            templatename = currentTemplate.getAttribute("data-mwf-templatename");
            console.log("found template " + templatename + ": " + currentTemplate);
            templates[templatename] = currentTemplate;
        }

        for (templatename in templates) {
            currentTemplate = templates[templatename];
            currentTemplate.parentNode.removeChild(currentTemplate);
        }
    };

    /* get a template */
    this.getTemplateInstance = function (templatename) {
        var template = templates[templatename];
        if (!template) {
            console.error("getTemplateInstance(): the template " + templatename + " does not exist!");
        }
        else {
            // we will always return a segmented object which has at least root set!!!
            var instance = null;
            if (template.classList.contains("mwf-databind")) {
                console.log("template " + templatename + " uses databinding. Return as root+body segmented object...");
                instance = {
                    root: template.cloneNode(false),
                    body: template.innerHTML
                };
            }
            else {
                instance = template.cloneNode(true);
                touchEnableOffspring(instance);
                instance = {root: instance};
            }

            return instance;
        }
    };

    /* get a template */
    this.hasTemplate = function (templatename) {
        var template = templates[templatename];
        return template != null && template != undefined;
    };
}


/*
 * a listview adapter that binds a list of objects to a view - we pass the controller, which will be called back for determining the view of a single element
 */
/*jslint nomen: true*/
function ListviewAdapter(_listview, _controller, _resources) {

    this.listviewId = null;
    this.elements = [];

    var listview;
    var listitemTemplateId;
    var controller;
    var resources;

    console.log("ListviewAdapter: initialising for listview " + listview);

    listview = _listview;
    // here we use the conventional id, rather than the mwf-id
    this.listviewId = listview.id;
    listitemTemplateId = listview.getAttribute("data-mwf-listitem-view");
    controller = _controller;
    resources = _resources;

    this.clear = function () {
        this.elements = [];
        mwfUtils.clearNode(listview);
    };

    this.addItemView = function (item) {
        var itemview = resources.getTemplateInstance(listitemTemplateId);
        mwfUtils.feedbackTouchOnElement(itemview.root);
        // by default, we set the itemid on the itemview
        itemview.root.setAttribute("data-mwf-id", item._id);
        // this is a sync call, i.e. we do not assume for any model operations to take place there... controller needs to do binding as side-effect on the itemview object
        controller.bindListItemView(this.listviewId, itemview, item);
        listview.appendChild(itemview.root);
        // scroll to the new item
        itemview.root.scrollIntoView();
    };

    // on initialising, we add a new listitem view for each element of the list
    this.addAll = function (elements) {
        var i, currentItem;
        for (i = 0; i < elements.length; i++) {
            currentItem = elements[i];
            this.elements.push(currentItem);
            this.addItemView(currentItem);
        }
    };

    // these are the functions that allow to manipulate list+view
    this.remove = function (itemId) {
        console.log("remove(): " + itemId);
        var selector = ".mwf-listitem[data-mwf-id=\'" + itemId + "\']";
        var itemview = listview.querySelector(selector);
        if (itemview) {
            itemview.parentNode.removeChild(itemview);
            var i;
            for (i = 0; i < this.elements.length; i++) {
                if (this.elements[i]._id == itemId) {
                    this.elements.splice(i, 1);
                    break;
                }
            }
        }
        else {
            console.warn("remove(): failed. cannot find itemview for id: " + itemId);
        }
    };

    this.add = function (item) {
        console.log("add(): " + item);
        this.addItemView(item);
        this.elements.push(item);
    };

    this.update = function (itemId, update) {
        console.log("update(): " + itemId + ", using update: " + mwfUtils.stringify(update));
        // lookup the itemview
        var selector = ".mwf-listitem[data-mwf-id=\'" + itemId + "\']";
        var itemview = listview.querySelector(selector);
        if (itemview) {
            var i, item, key;
            // we first lookup the existing item and update it
            for (i = 0; i < this.elements.length; i++) {
                if (this.elements[i]._id == itemId) {
                    item = this.elements[i];
                    for (key in update) {
                        item[key] = update[key];
                    }
                    break;
                }
            }
            if (item) {
                // we can let the controller bind the item without creating a new view - if we use databinding the item will be replaced, though...
                console.log("updating item in listview: " + item);
                // using templating, we need to replace the existing element with a new one (replacement will be passed as optional 4th argument
                controller.bindListItemView(this.listviewId, itemview, item, resources.getTemplateInstance(listitemTemplateId));
            }
        }
        else {
            console.warn("update(): failed. cannot find itemview for id: " + itemId);
        }
    };

    this.read = function (itemId) {
        console.log("ListviewAdapter.read(): " + itemId + ", num of elements are: " + this.elements.length);
        var i;
        for (i = 0; i < this.elements.length; i++) {
            console.log("checking element: " + mwfUtils.stringify(this.elements[i]));
            if (this.elements[i]._id == itemId) {
                return this.elements[i];
            }
        }
        return null;
    };

    this.getItemview = function (itemId) {
        console.log("ListviewAdapter.getItemview(): " + itemId + ", num of elements are: " + this.elements.length);
        var selector = ".mwf-listitem[data-mwf-id=\'" + itemId + "\']";
        var itemview = listview.querySelector(selector);

        if (!itemview) {
            console.error("getItemview(): no itemview could be obtained for item with id: ", itemId);
        }
        return itemview;
    };

    this.length = function() {
        return this.elements.length;
    };

}
/*jslint nomen: false */

// for conceptual/terminological clarity, we introduce a second constructor for event: EventMatcher, which will not accept a data object
function EventMatcher(group, type, target) {
    if (arguments.length == 4) {
        alert("ERROR: EventMatcher does not accept 4 arguments. Do you intend to use Event?");
    }
    // call the supertype constructor
    eventhandling.Event.call(this,group,type,target);
}
mwfUtils.xtends(EventMatcher,eventhandling.Event);

/*
 * generic view controller implementation
 */
class ViewController {

    constructor() {
        this.lcstatus = CONSTANTS.LIFECYCLE.CONSTRUCTED;

        this.pendingEventListeners = [];

        // the root of our view
        this.root = null;
        // the args that we are using
        this.args = null;
        // hold a dialog
        this.dialog = null;

        // we may manage multiple listview adapters (see e.g. search results in spotify)
        this.listviewAdapters = {};

        // if we have an actionmenu this attribute contains a map from menu item ids to the dom elements that represent the item - note that manipulation of this list is not possible - if new items shall be added, it needs to be done via onPrepareActionmenu
        // maybe this should be removed...
        this.actionmenuItems = {};
    }

    /*
     * an event listener that hides all overlay elements - we need to declare it like this in order to be able to access it from the lifecycle functions
     * it will be added oncreate and onresune, and removed onpause and onstop
     */
    hideOverlays() {
        console.log("hideOverlays(): " + this.root);
        // on nextview we need to hide anything that is dialog
        hideMenusAndDialogs.call(this);
    }

    /*
     * inheritable and overridable prototype functions (instance methods) of ViewController
     *
     * notice the reference from prototype functions to instance attributes via this - this allows for each subclass instace to inherit the functions while accessing their own attributes
     */
    setViewAndArgs(view, args) {
        console.log("ViewController.setViewAndArgs(): " + view.id);
        console.log("ViewController.setViewAndArgs() view: " + view + ", args: " + (args ? mwfUtils.stringify(args) : " no args"));

        this.root = view;
        this.args = args;

        // REFACVIEWS:
        // here, we attach the root to the document body
        document.body.appendChild(this.root);
    }

    /*
     * if the view has already been set (e.g. for dialogs), args can be passed
     */
    setArgs(args) {
        console.log("ViewController.setArgs(): id: " + this.root.id);
        console.log("ViewController.setArgs(): args: " + (args ? mwfUtils.stringify(args) : " no args"));

        this.args = args;
    }

    /*
     * this function is not publicly exposed
     * #ES6: make it an instance method /ES6
     */
    async prepareActionmenu() {
        console.log("prepareActionmenu()");
        // initialise the actionmenu if one exists
        var actionmenuControl = this.root.getElementsByClassName("mwf-actionmenu-control");
        var actionmenu = this.root.getElementsByClassName("mwf-actionmenu");
        if (actionmenuControl.length > 0) {
            actionmenuControl = actionmenuControl[0];
            actionmenu = actionmenu[0];

            /*
             * control opening and closing the menu
             */
            actionmenuControl.onclick = (event) => {
                // we do not propagate it upwards...
                event.stopPropagation();
                // if the menu is not expanded prenventionally close a sidemenu if one exists
                if (!actionmenu.classList.contains("mwf-expanded")) {
                    hideMenusAndDialogs.call(this);
                    this.onPrepareActionmenu(actionmenu).then(actionmenu => {
                        actionmenu.removeEventListener("click", cancelClickPropagation);
                        actionmenu.addEventListener("click", cancelClickPropagation);
                        actionmenu.classList.toggle("mwf-expanded");
                    });
                }
                else {
                    actionmenu.classList.remove("mwf-expanded");
                }
            }

            /*
             * update the local representation of the actionmenuItems and set listeners on the menu items
             */
            this.updateActionmenuItems(actionmenu);
            var itemid;
            for (itemid in this.actionmenuItems) {
                // set listener
                this.actionmenuItems[itemid].onclick = function (event) {
                    // inside the event handler we MUST NOT use the expression this.actionmenuItems[itemid] because it will always point to the last element in the list...
                    // TODO: we could let the item control whether the menu shall be closed or not (closing is default, as then the click event bubbles upwards)
                    if (event.currentTarget.classList.contains("mwf-menu-item")) {
                        this.onActionmenuItemSelected(event.currentTarget);
                    }
                }.bind(this);
            }
        }

    }

    // for the time being, we simply reset all forms
    // #ES6: make it instance method of view controller
    prepareForms(element) {
        var formEls = element.getElementsByTagName("form");
        var i;
        for (i=0;i<formEls.length;i++) {
            formEls[i].reset();
        }
    }

    /*
     * this is for initialising generic listview funcitonality
     * #ES6: make it an instance method /ES6
     */
    prepareListviews() {
        console.log("prepareListviews()");
        // read out listviews (! we might have more than a single listview, see e.g. types search results in spotify etc.)
        var listviews = this.root.getElementsByClassName("mwf-listview");
        if (listviews.length == 0) {
            console.log("prepareListviews(): view " + this.root.id + " does not use listviews");
        }
        else if (this.listviewsPrepared) {
            console.warn("prepareListviews(): views seem to have been prepared already for " + this.root.id + ". Ignore call...");
        }
        else {
            console.log("prepareListviews(): found " + listviews.length + " listviews");

            // this is the listview selection handler that both covers item selection and item menu selection - note that we use a single function that will handle all listviews (if there exists more than one)
            var listviewSelectionListener = function (event) {

                // ignore the list selection if there is any overlay shown
                // TODO: these checks should be implemented in a less resource consuming way...
                if (document.querySelector(".mwf-listitem-menu.mwf-shown") || document.querySelector(".mwf-sidemenu.mwf-expanded") || document.querySelector(".mwf-actionmenu.mwf-expanded") || document.querySelector(".mwf-dialog.mwf-shown")) {
                    console.log("ignore list item selection. There is an active dialog!");
                    return;
                }

                // we need to recursively look up the potential targets that are interesting for us, we always collect the listitem and the listview
                function lookupTarget(currentNode, eventData) {
                    // using templating, lookup does not work because there are cycles...
                    //console.log("lookupTarget(): " + JSON.stringify(eventData));

                    // if we have reached the listview, the event is not of interest for us
                    if (currentNode.classList.contains("mwf-listview")) {
                        if (!eventData) {
                            console.log("got click/touch event on listview, but neither a listitem, nor a listitem menu seems to have been selected");
                        }
                        else {
                            eventData.listview = currentNode;
                        }
                    }
                    // if we have reached the menu control, we need to move upwards because we still need to find out which item is meant
                    else if (currentNode.classList.contains("mwf-listitem-menu-control")) {
                        if (!eventData) {
                            eventData = {};
                        }
                        console.log("found a listitem-menu in listview event");
                        eventData.eventType = "itemMenuSelected";
                        eventData = lookupTarget(currentNode.parentNode, eventData);
                    }
                    // also allow to embed actions directly in list items
                    else if (currentNode.classList.contains("mwf-listitem-action")) {
                        if (!eventData) {
                            eventData = {};
                        }
                        console.log("found a listitem-action in listview event");
                        eventData.eventType = "itemActionSelected";
                        eventData.listitemAction = currentNode;
                        eventData = lookupTarget(currentNode.parentNode, eventData);
                    }
                    else if (currentNode.classList.contains("mwf-listitem")) {
                        console.log("found a listitem in listview event");
                        if (!eventData) {
                            eventData = {};
                        }
                        else if (!eventData.eventType) {
                            eventData.eventType = "itemSelected";
                            console.log("listview event is item selection");
                        }
                        // here we set the item
                        eventData.listitem = currentNode;
                        eventData = lookupTarget(currentNode.parentNode, eventData);
                    }
                    else {
                        eventData = lookupTarget(currentNode.parentNode, eventData);
                    }

                    return eventData;
                }

                // we lookup the target
                var eventData = lookupTarget(event.target);

                //console.log("loopupTarget(): result is: " + (eventData ? JSON.stringify(eventData) : " no target found!"));

                if (eventData) {
                    event.stopPropagation();
                    mwfUtils.removeTouch(eventData.listitem);

                    // if we have an itemMenuSelected event we stop propagation - otherwise a itemSelection event will be triggered
                    if (eventData.eventType == "itemMenuSelected") {
                        this.onListItemMenuSelected(eventData.listitem, eventData.listview);
                    }
                    // we invoke the itemMenuItemSelected function which will also be called when selecting an action from the action menu
                    else if (eventData.eventType == "itemActionSelected") {
                        this.onListItemMenuItemElementSelected(eventData.listitemAction, eventData.listitem, eventData.listview);
                    }
                    else {
                        this.onListItemElementSelected(eventData.listitem, eventData.listview);
                    }
                }

            }.bind(this);

            // we set it on all listviews
            var i;
            for (i = 0; i < listviews.length; i++) {
                // we add the listview under its id (not mwf-id!) to the listviews map
                this.listviewAdapters[listviews[i].id] = new ListviewAdapter(listviews[i], this, applicationResources);
                listviews[i].onclick = listviewSelectionListener;
            }

            this.listviewsPrepared = true;

        }
    }

    /*
     * implements default behaviour for actionmenu. subtypes might override the function to cover behaviour that is not dealt with generically here
     */
    onActionmenuItemSelected(item) {
        if (item.classList.contains("mwf-disabled")) {
            console.log("ViewController.onActionmenuItemSelected(): action is disabled!");
        }
        else {
            console.log("ViewController.onActionmenuItemSelected(): " + item);
            // check whether the menu item has a data-mwf-targetview or data-mwf-targetaction attribute
            if (item.hasAttribute("data-mwf-targetview")) {
                var targetview = item.getAttribute("data-mwf-targetview");
                console.log("ViewController.onActionmenuItemSelected(): item specifies a targetview: " + targetview);
                this.nextView(targetview);
            }
            else if (item.hasAttribute("data-mwf-targetaction")) {
                var targetaction = item.getAttribute("data-mwf-targetaction");
                console.log("ViewController.onActionmenuItemSelected(): item specifies a targetaction: " + targetaction);
                // we invoke the function dynamically - TODO: need to check how this can be done more elegantly than using eval
                var targetactionfunction = "this." + targetaction + "()";
                eval(targetactionfunction);
            }
            else {
                alert("Cannot handle actionmenu item with mwf-id: " + item.getAttribute("data-mwf-id") + "! Remove the item or override onActionmenuItemSelected locally!");
            }
        }
    };

    /*
     * allows subtypes to react to itemMenu selection - this is the default implementation that uses the mwf-listitem-menu attribute
     */
    async onListItemMenuSelected(listitem, listview) {
        console.log("ViewController.onListItemMenuSelected(): " + listitem + "." + listitem.getAttribute("data-mwf-id") + " from " + listview);
        var listitemMenuId = listview.getAttribute("data-mwf-listitem-menu");
        if (!listitemMenuId) {
            console.log("onListItemMenuSelected(): no listItemMenuId is specified. If listitem menu selection shall be handled, this function needs to be overridden");
        }
        else {
            var menuElement = null;
            // check whether the menu is a template, in which case it will be cloned
            // TODO: apply this logics also to "normal" dialogs!
            if (applicationResources.hasTemplate(listitemMenuId)) {
                menuElement = this.getTemplateInstance(listitemMenuId);
            }
            else {
                // REFACVIEWS
                // menuElement = document.getElementById(listitemMenuId);
                menuElement = getTopLevelView(listitemMenuId);
            }
            //mwfUtils.feedbackTouchOnElement(menuElement);

            // TODO: we could also use data binding for the list item menu...
            if (!menuElement.tagName) {
                // check whether we have mwf-databind active
                if (menuElement.root.classList.contains("mwf-databind")) {
                    // note that item is a dom element and not the item object
                    var itemObj = this.readFromListview(listitem.getAttribute("data-mwf-id"));
                    applyDatabinding(menuElement.root, menuElement.body, itemObj);
                }
                menuElement = menuElement.root;
            }

            console.log("using listitemMenu: " + menuElement);

            // we allow subclasses to prepare the menu for the given item - this is done asynchronously in case some background processig needs to be done
            var preparedMenu = await this.onPrepareListitemMenu(menuElement, listitem, listview);

            // we set a listener on the menu element that listens to list item selection - TODO: also realise the one-listener solution for the other menus (sidemnu, actionmenu)
            var listitemMenuItemSelectedListener = function (event) {

                function lookupTarget(node) {
                    if (node.classList.contains("mwf-listitem-menu")) {
                        console.log("we already reached the root of the menu. Click does not seem to have selected a menu item...");
                        return null;
                    } /* generalise listitem-action */
                    else if (node.classList.contains("mwf-menu-item") || node.classList.contains("mwf-listitem-action")) {
                        return node;
                    } else {
                        return lookupTarget(node.parentNode);
                    }
                }

                var targetItem = lookupTarget(event.target);
                if (targetItem) {
                    // only hide the dialog if an item has been selected (clicking outside of the dialog area will hide the dialog, too)
                    this.hideDialog();
                    // we feedback which menu item for which item of which listview has been selected...
                    this.onListItemMenuItemElementSelected(targetItem, listitem, listview);
                }

            }.bind(this);

            console.log("setting menuItemSelectedListener on: " + preparedMenu);

            // set the listener on the menu
            preparedMenu.addEventListener("click", listitemMenuItemSelectedListener);

            // we will show the menu as a dialog
            this.showDialog(preparedMenu).then(function () {
                console.log("listitem menu is shown as dialog...");
            });

        }
    }

    /* in the default case we just pass the menu without changes to the dialog - for the user, however, it would be nice for the dialog to give feedback about the id of the selected item. In this case, subtypes must override this function */
    async onPrepareListitemMenu(menu, item, list) {
        return menu;
    }

    /*
     * allows subtypes to react to item selection: we may react to the selection of the view element, but provide a default that does some standard handling
     */
    onListItemElementSelected(listitemEl, listview) {
        console.log("ViewController.onListItemElementSelected(): " + listitemEl + " from " + listview);
        var itemId = listitemEl.getAttribute("data-mwf-id");
        mwfUtils.removeTouch(listitemEl);
        console.log("ViewController.onListItemElementSelected(): itemId is: " + itemId);

        var itemObj = this.readFromListview(itemId,listview.id);
        if (!itemObj) {
            console.error("ViewController.onListItemElementSelected(): item with selected id " + itemId + " not found in list!");
        }
        else {
            // this handling could be generalised!
            var targetview = listitemEl.getAttribute("data-mwf-targetview");
            var targetaction = listitemEl.getAttribute("data-mwf-targetaction");
            if (targetaction) {
                console.log("ViewController.onListItemElementSelected(): will call targetaction on view controller: " + targetaction);
                // we invoke the function dynamically
                (this[targetaction]).call(this,itemObj);
            }
            else if (targetview) {
                console.log("ViewController.onListItemElementSelected(): will open targetview on view controller: " + targetview);
                // we pass the item as argument using the key "item"
                this.nextView(targetview, {item: itemObj});
            }
            //
            else {
                console.log("ViewController.onListItemElementSelected(): will call onListItemSelected()");
                this.onListItemSelected(itemObj, listview.id, listitemEl);
            }
        }

    }

    onListItemSelected(listitem, listviewid) {
        console.info("ViewController.onListItemSelected(): " + listitem + " from " + listviewid + ". Override this function locally in order to implement desired behaviour...");
    }

    /*
     * allows subtypes to react to item selection - by default we check whether a targetview or targetaction has been specified
     * may be partially overridden for specific items and be dealt with as default by supertype call in the particular controller
     *
     * menuitem: the selected element from the menu
     * listitem: the list element for which the menu was created
     * listview: the listview
     */
    onListItemMenuItemElementSelected(menuitem, listitemelement, listview) {
        console.log("ViewController.onListItemMenuItemElementSelected(): " + menuitem + " for " + listitemelement + " from " + listview);

        var itemid = listitemelement.getAttribute("data-mwf-id");

        if (itemid) {
            var itemObj = this.readFromListview(listitemelement.getAttribute("data-mwf-id"));
            if (!itemObj) {
                console.warn("ViewController.onListItemMenuItemElementSelected(): Item with id does not seem to be contained in list: " + listitemelement.getAttribute("data-mwf-id") + ". Either this is an error, or selection must be handled by implementing onListItemMenuItemSelected in view controller");
                this.onListItemMenuItemSelected(menuitem,null,listview);
            }
            else {
                this.onListItemMenuItemSelected(menuitem,itemObj,listview);
            }
        }
        else {
            console.warn("ViewController.onListItemMenuItemElementSelected(): no itemid specified for listitem. Handling selection needs to be dealt with by the given view controller implementation: " + itemid + "/" + targetview + "/" + targetaction);
            this.onListItemMenuItemSelected(menuitem,null,listview);
        }

    }

    onListItemMenuItemSelected(menuitem,itemObj,listview) {
        var targetview = menuitem.getAttribute("data-mwf-targetview");
        var targetaction = menuitem.getAttribute("data-mwf-targetaction");

        if (targetaction) {
            console.log("ViewController.onListItemMenuItemSelected(): will call targetaction on view controller: " + targetaction);
            // we invoke the function dynamically - TODO: need to check how this can be done more elegantly than using eval
            var targetactionfunction = "this." + targetaction + "(itemObj)";
            // by default, the function will be passed the item
            eval(targetactionfunction);
        }
        else if (targetview) {
            console.log("ViewController.onListItemMenuItemSelected(): will open targetview on view controller: " + targetview);
            // we pass the item as argument using the key "item"
            this.nextView(targetview,{item: itemObj});
        }
        else {
            console.error("ViewController.onListItemMenuItemSelected(): selected menu item neither specifies targetview nor targetaction. Either this is an error, or the item should be dealt with in local view controller implementation.");
        }
    }

    /*
     * allows to populate the menu element with dynamic items or to enable/disable items - we also add a callback here
     */
    async onPrepareActionmenu(menu) {
        console.log("ViewController.onPrepareActionmenu(): " + menu);
        return menu;
    }

    /*
     * need to check whether this makes sense: update the actionmenuItems on updating the dom
     */
    updateActionmenuItems(menu) {
        console.log("ViewController.updateActionmenuItems(): " + menu);
        var menuitemElements = menu.getElementsByClassName("mwf-menu-item");
        this.actionmenuItems = {};
        var i, currentItem;
        for (i = 0; i < menuitemElements.length; i++) {
            // if we have a mwfid
            currentItem = menuitemElements[i];
            if (currentItem.hasAttribute("data-mwf-id")) {
                console.log("updateActionmenuItems(): found menuitem: " + currentItem.getAttribute("data-mwf-id"));
                this.actionmenuItems[currentItem.getAttribute("data-mwf-id")] = currentItem;
            }
            else {
                // otherwise we create an anonymous item entry using the counter
                console.log("updateActionmenuItems(): found anonymous menuitem: " + currentItem);
                this.actionmenuItems[i] = currentItem;
            }
        }
        console.log("updateActionmenuItems(): items are: " + mwfUtils.stringify(this.actionmenuItems));
    }

    // REMOVE: back action
    // TODO: why remove? This could be handled in a generic way...
    onback() {
        console.log("ViewController.onback(): " + this.root.id);
        this.previousView();
    }

    async onpause() {
        console.log("ViewController.onpause(): " + this.root.id);

        // REFACVIEWS
        // distinguish between dialog ctrl and other
        if (this.isDialogCtrl) {
            this.root.classList.remove("mwf-shown");
            this.root.classList.add("mwf-hidden");
        }
        else {
            this.root.classList.remove("mwf-currentview");
            this.root.classList.add("mwf-paused");
        }

        this.root.onclick = null;

        // REFACVIEWS: we need to check the previ
        if (this.lcstatus != CONSTANTS.LIFECYCLE.OBSOLETE) {
            console.log("REFACVIEWS: adding transitionend to non obsolete controller with lifecycle: ", this.lcstatus, this.root);
            addRemoveOnFadedToElement(this.root);
        }
        else {
            console.log("REFACVIEWS: skip adding transitionend to obsolete controller: ", this.root);
        }

        this.lcstatus = CONSTANTS.LIFECYCLE.PAUSED;
    }

    // the four lifecycle methods which we realise by setting class attributes
    async oncreate() {
        console.log("ViewController.oncreate(): " + this.root.id);

        console.log("ViewController.oncreate(): " + this.root);

        // reset pending event listener (there should not be any, though...)
        this.pendingEventListeners = [];

        // we reset all elements from the root that are marked as dynamic
        var dynelements = this.root.querySelectorAll(".mwf-dyncontent-root");
        console.log("clearing " + dynelements.length + " dynamic elements");
        var i;
        for (i = 0; i < dynelements.length; i++) {
            dynelements[i].innerHTML = "";
        }
        // we also reset all elements that are marked as dynvalue
        var dynvalelements = this.root.querySelectorAll(".mwf-dynvalue");
        console.log("clearing " + dynvalelements.length + " dynamic value elements");
        for (i = 0; i < dynvalelements.length; i++) {
            dynvalelements[i].value = "";
        }

        // initialise generic controls if there exist any...
        await this.prepareActionmenu();
        if (!this.listviewsPrepared) {
            this.prepareListviews();
        }
        this.prepareForms(this.root);

        // generalise back button handling
        var backbutton = this.root.querySelector(".mwf-back");
        console.log("got backbutton on " + this.root.id + ": " + backbutton);
        if (backbutton) {
            backbutton.onclick = function () {
                this.onback();
            }.bind(this);
        }

        // a generic click handler that will close any menus...
        this.root.onclick = this.hideOverlays.bind(this);

        // we will not display a view oncreate!
        // instance.root.classList.remove("mwf-idle");
        // instance.root.classList.remove("mwf-stopped");
        // instance.root.classList.remove("mwf-paused");
        // instance.root.classList.add("mwf-currentview");

        console.log("oncreate (done)");

        this.lcstatus = CONSTANTS.LIFECYCLE.CREATED;
    }

    async onresume() {
        console.log("ViewController.onresume(): " + this.root.id);

        document.body.appendChild(this.root);

        // REFACVIEWS: in order for transitions to work on freshly appended views, we need a timeout
        await mwfUtils.timeout(100);

        // on resume the next view will be displayed!
        if (this.isDialogCtrl) {
            this.root.classList.remove("mwf-hidden");
            this.root.classList.add("mwf-shown");
        }
        else {
            this.root.classList.remove("mwf-idle");
            this.root.classList.remove("mwf-stopped");
            this.root.classList.remove("mwf-paused");
            this.root.classList.add("mwf-currentview");
        }

        var hideOverlays = this.hideOverlays.bind(this);

        this.root.onclick = hideOverlays;
        // also add it to the body
        document.getElementsByTagName("body")[0].onclick = hideOverlays;

        // we (try to) set autofocus...
        handleAutofocus(this.root);

        this.lcstatus = CONSTANTS.LIFECYCLE.SHOWING;

        this.processMaterialElements();

        // check whether we have pending event listeners
        // TODO: here, event listeners could be checked for obsoletion...
        if (this.pendingEventListeners.length == 0) {
            console.log("ViewController.onresume(): no pending event listeners exist");
        }
        else {
            console.log("ViewController.onresume(): found pending event listeners: " + this.pendingEventListeners.length);
            // we process from beginning to end, rather than dealing the listeners array as a stack
            var currentListener;
            while (this.pendingEventListeners.length > 0) {
                currentListener = this.pendingEventListeners[0];
                console.log("ViewController.onresume(): will run pending event listener for: " + currentListener.boundEvent.desc());
                this.pendingEventListeners.splice(0,1);
                currentListener.call();
            }
        }
    }

    /* this is for processing experimental functionality for material elements */
    // TODO: handle fieldset elements with multiple input children
    processMaterialElements() {
        if (this.root.getElementsByClassName("mwf-material").length > 0) {
            console.log("processMaterialElements(): view uses material elements...");

            // check whether we have mwf-material fieldset elements which need to be supported by setting oninput event handlers
            // JK 180205: also handle alternative input
            this.root.querySelectorAll("fieldset.mwf-material").forEach((fs) => {
                console.log("processMaterialElements(): postprocessing material element: " + fs);
                // we directly set the listener rather than using addEventListener()
                var inputel = fs.querySelector("input, textarea");
                if (inputel) {
                    var lastvalue = null;
                    fs.oninput = () => {
                        console.log("oninput()");
                        // always add mwf-valid oninput
                        fs.classList.add("mwf-material-valid");
                        if (inputel.value && inputel.value.length > 0) {
                            fs.classList.add("mwf-material-filled");
                        }
                        else {
                            fs.classList.remove("mwf-material-filled");
                        }
                        lastvalue = inputel.value;
                    }
                    // if the input can be provided alternatively, we also add an onchange listener
                    if (inputel.classList.contains("mwf-material-altinput-target")) {
                        // we add the same listener to onchange
                        fs.onchange = (evt) => {
                            console.log("onchange()");
                            // always add mwf-valid oninput
                            fs.classList.add("mwf-material-valid");
                            if (inputel.value && inputel.value.length > 0) {
                                fs.classList.add("mwf-material-filled");
                            }
                            else {
                                fs.classList.remove("mwf-material-filled");
                            }
                            // check whether the lastvalue obtained by input is identical with the current value, otherwise input must have been provided alternatively
                            // this is for providing the "srcType" information previously added by radio buttons in a generalised way
                            if (lastvalue == inputel.value) {
                                console.log("input provided by input!");
                                inputel.classList.remove("mwf-material-filled-altinput");
                            }
                            else {
                                console.log("input provided by altinput!");
                                inputel.classList.add("mwf-material-filled-altinput");
                            }
                        }
                    }
                    // if the input is not empty, we need to set the field to filled
                    if (inputel.value && inputel.value.length > 0) {
                        fs.classList.add("mwf-material-filled");
                    }
                }
            });

            // override default handling of validity by the browser...
            this.root.querySelectorAll("fieldset.mwf-material input").forEach(el => {
                el.classList.add("mwf-material-valid");
                var fs = retrieveAncestor(el, "FIELDSET");
                fs.classList.add("mwf-material-valid");
                el.oninvalid = (event) => {
                    console.log("input.oninvalid(): ", el, event, el.validity);
                    event.preventDefault();
                    el.classList.remove("mwf-material-valid");
                    fs.classList.remove("mwf-material-valid");
                    // we need to add mwf-material-filled to the fs
                    fs.classList.add("mwf-material-filled");
                    // we will add a span to the legend
                    this.addMaterialFeedbackSpanToLegend(fs, el);
                }
                el.oninput = () => {
                    el.classList.add("mwf-material-valid");
                    el.classList.add("mwf-material-valid");
                }
            });
        }
        else {
            console.log("processMaterialElements(): view does not seem to use material elements.");
        }
    }

    addMaterialFeedbackSpanToLegend(fs, input) {
        // get the legend
        var legends = fs.getElementsByTagName("legend");
        if (legends.length != 1) {
            console.log("addMaterialFeedbackSpanToLegend(): no or multiple legends exist. Ignore...");
            return;
        }
        var span = legends[0].getElementsByClassName("mwf-material-feedback");
        if (span.length == 0) {
            span = document.createElement("span");
            span.classList.add("mwf-material-feedback");
            legends[0].appendChild(span);
        }
        else {
            span = span[0];
            span.innerHTML = "";
        }

        // cover a range of validity issues
        var valstate = input.validity;
        var valtxt = "";
        if (valstate.valueMissing) {
            valtxt = "Eingabe erforderlich";
        }
        else if (valstate.typeMismatch || valstate.patternMismatch) {
            valtxt = "Eingabe ungültig";
        }
        else if (valstate.customError) {
            valtxt = input.validationMessage;
        }
        else {
            valtxt = "Fehler";
        }

        span.appendChild(document.createTextNode(valtxt));
    }

    async onstop() {
        console.log("ViewController.onstop(): " + this.root.id);
        this.root.classList.remove("mwf-currentview");
        this.root.classList.add("mwf-stopped");

        this.root.onclick = null;

        // we unbind the listeners that have been registered by us
        eventhandling.removeListenersForOwner(this);

        this.lcstatus = CONSTANTS.LIFECYCLE.STOPPED;
    }

    nextView(viewid, viewargs, asRootView) {
        console.log("ViewController.nextView(): " + viewid);

        // if nextView is called in rootView mode, we first clear all controllers and then call nextView...
        if (asRootView) {
            applicationState.clearControllers(function () {
                console.log("calling nextView() recursively, without rootView option");
                this.nextView(viewid, viewargs, false);
            }.bind(this));
        }
        else {
            // REFACVIEWS
            // var nextView = document.getElementById(viewid);
            var nextView = getTopLevelView(viewid);
            if (!nextView) {
                alert("ERROR: Next view " + viewid + " could not be found!");
            } else {
                // detetermine which view controller we shall use
                var nextViewControllerClassname = nextView.getAttribute("data-mwf-viewcontroller");
                console.log("using next view controller: " + nextViewControllerClassname);

                // we create a new instance of the view controller
                var nextViewControllerFunction = thisapp[nextViewControllerClassname];//require(nextViewControllerClassname);

                var nextViewController = new nextViewControllerFunction();
                console.log("created next view controller:: " + nextViewController);
                nextViewController.setViewAndArgs(nextView, viewargs);
                nextViewController.application = applicationObj;
                applicationState.pushViewController(nextViewController, asRootView);
            }
        }
    }

    // prevent going back to the grey nothing if back is pressed from the only active controller
    previousView(returnData, returnStatus) {
        console.log("REFACVIEWS: previousView(): " + this.root.id, this.root);
        if (applicationState.countControllers() < 2) {
            this.onPreviousViewBlocked();
            return;
        }
        applicationState.popViewController(returnData, returnStatus);
    }

    onPreviousViewBlocked() {
        alert("There is no previous view we can return to. Keep current view.");
    }

    getBody() {
        return this.root.querySelector(".mwf-body");
    }

    /* show a dialog - the first argument may either be a string or an object */
    /* TODO: allow to pass data to which the dialog will be bound */
    async showDialog(dialogid, data) {
        var isTemplate = false;

        console.log("showDialog(): " + dialogid + "@" + this.root.id);

        // hide any other overlay elements
        hideMenusAndDialogs.call(this);

        // now instantiate the new dialog
        // TODO: dialogs should be dealt with using the templating mechanism unless the dialog is provided as an argument
        if (typeof dialogid == 'object') {
            this.dialog = dialogid;
        }
        else {
            // either we find the dialog in the document, or the dialog is a template
            // REFACVIEWS
            // this.dialog = document.getElementById(dialogid);
            this.dialog = getTopLevelView(dialogid);
            if (!this.dialog) {
                console.log("lookup dialog as template: " + dialogid);
                this.dialog = this.getTemplateInstance(dialogid);
                isTemplate = true;
            }
        }

        // check whether we have a template
        if (isTemplate) {
            this.bindDialog(dialogid, this.dialog, data);
            this.dialog = this.dialog.root;
        }

        // REFACVIEWS: there might be timing issues...
        if (this.dialog) {

            // we reset all forms
            this.prepareForms(this.dialog);

            // if the dialog is a child of the view controller, move it next to it as otherwise hiding the dialog controller in the background will not work - it seems that this does not need to be undone
            if (!this.dialog.parentNode) {
                this.root.parentNode.appendChild(this.dialog);
            }
            else if (this.dialog.parentNode == this.root) {
                this.root.parentNode.appendChild(this.root.removeChild(this.dialog));
            }

            var rootelement = this.root;

            // we set the dialog to hidden
            this.dialog.classList.add("mwf-hidden");
            // we need to instantiate the dialog in two steps because if it is included in a view it seems to be overlayn regardless of the z-index
            // REFACVIEWS
            await mwfUtils.timeout(100);
            // we cancel click propagation
            this.dialog.removeEventListener("click", cancelClickPropagation);
            this.dialog.addEventListener("click", cancelClickPropagation);

            var dia = this.dialog;
            handleAutofocus(dia);

            // REFACVIEWS
            // check whether the dialog uses a view controller or not
            var dialogCtrl = applicationState.getEmbeddedController(dialogid);
            if (dialogCtrl) {
                await this.handleDialogWithController(dialogCtrl, data);
            }
            else {
                dia.classList.add("mwf-shown");
                dia.classList.remove("mwf-hidden");
                rootelement.classList.add("mwf-dialog-shown");
            }
        }
    }

    async handleDialogWithController(dialogCtrl,data) {
        console.log("showDialog(): dialog uses view controller. Pass arguments and call onresume.");
        dialogCtrl.setViewAndArgs(this.dialog,data || {});

        // if we have an dialog controller, the hideDialog() and showDialog() functions need to be bound to the currently active view controller, rather than
        // to the embedded controller. Try it...
        dialogCtrl.showDialog = this.showDialog.bind(this);
        dialogCtrl.hideDialog = this.hideDialog.bind(this);

        // REFACVIEWS
        // we tell the dialog that it is a dialog controller
        dialogCtrl.isDialogCtrl = true;

        console.log("lcstatus of dialog controller: " + dialogCtrl.lcstatus);
        this.root.classList.add("mwf-dialog-shown");

        // check whether the dialog has already been created or if it is only in constructed mode
        if (dialogCtrl.lcstatus == CONSTANTS.LIFECYCLE.CONSTRUCTED) {
            console.log("showDialog(): dialog view controller needs to be initialised. Will call oncreate()...");
            await dialogCtrl.oncreate();
            await dialogCtrl.onresume();
            console.log("will cancel click on dialog controller...");
            dialogCtrl.root.onclick = cancelClickPropagation;
        }
        else {
            await dialogCtrl.onresume();
            console.log("will cancel click on dialog controller...");
            dialogCtrl.root.onclick = cancelClickPropagation;
        }
    }

    /* hide a dialog */
    async hideDialog() {
        console.log("hideDialog(): " + this.dialog + "@" + this.root.id);
        if (!this.dialog) {
            console.log("hideDialog(): There is no active dialog! Ignore...");
        } else {
            this.dialog.onclick = null;
            this.root.classList.remove("mwf-dialog-shown");
            this.dialog.classList.remove("mwf-shown");
            console.log("hideDialog(): removal done...");

            // check whether the dialog uses a view controller or not
            var dialogCtrl = applicationState.getEmbeddedController(this.dialog.id);
            if (dialogCtrl) {
                console.log("hideDialog(): call onpause on dialog controller");
                // we call on pause
                this.dialog = null;
                await dialogCtrl.onpause();
            }
            else {
                console.log("hideDialog(): prepare removal on faded for dialog without controller", this.dialog);
                // REFACVIEWS:
                // we remove the dialog on transitionend
                console.log("REFACVIEWS: adding transitionend for dialog: ", this.dialog);
                addRemoveOnFadedToElement(this.dialog);
                this.dialog.classList.add("mwf-hidden");
                this.dialog = null;
            }
        }
    }

    getTemplateInstance(templatename) {
        console.log("getTemplateInstance(): " + templatename);
        return applicationResources.getTemplateInstance(templatename);
    }

    /*
     * bind a view element to some data - elementid might either be an element or a template - this function will be used by subclasses, e.g. for instantiating forms
     */
    bindElement(elementid, data, parent) {
        console.log("bindElement(): " + elementid);

        var boundElement = null;

        function isTemplateWrapper(element) {
            // either no classes (mere div wrapper), or mwf-template and at most mwf-databind
            if (((element.tagName.toLowerCase() == "div") || (element.tagName.toLowerCase() == "span")) && (element.classList.length == 0 || (element.classList.contains("mwf-template") && (element.classList.length == 2 ? element.classList.contains("mwf-databind") : element.classList.length == 1)))) {
                console.log("bindElement(): element is a mere wrapper. Will attach it to root elemenent if provided: " + parent);
                return true;
            }
            return false;
        }

        if (typeof elementid == 'string') {
            var element = this.root.querySelector("#" + elementid);
            if (!element) {
                console.log("bindElement(): binding to a template");
                element = this.getTemplateInstance(elementid);
                console.log("bindElement(): found template: " + element);

                // check whether we have a mere template, whose content needs to be unwrapped
                applyDatabinding(parent && isTemplateWrapper(element.root) ? parent : element.root, element.body, data);

                boundElement = element.root;
            }
            else {
                console.log("bindElement(): binding to a non-template element");
                applyDatabinding(parent && isTemplateWrapper(element) ? parent : element, element.innerHTML, data);

                boundElement = element;
            }
        }
        else {
            // otherwise we have a element that may be treated itself as a template root
            console.log("bindElement(): binding a dom element");
            applyDatabinding(parent && isTemplateWrapper(elementid) ? parent : elementid, elementid.innerHTML, data);

            boundElement = elementid;
        }

        if (boundElement) {
            if (parent) {
                parent.appendChild(boundElement);

                // TODO: this is a workaround related to the not completely transparent logics of whether the root or the element itself is passed to applyDatabinding
                if (!parent.viewProxy) {
                    parent.viewProxy = boundElement.viewProxy;
                }

                return parent;
            }
            return boundElement;
        }

        console.log("bindElement(): failed for: " + elementid);
        return null;
    }

    /*
     * this is for listview handling - note that the last parameter is always the optional parameter that identifies the listview
     */
    initialiseListview(items, listviewid) {
        if (!this.listviewsPrepared) {
            console.log("initialiseListview(): listviews have not yet been prepared for " + this.root.id + ". Prepare them...");
            this.prepareListviews();
        }

        var listview = getListviewAdapter.call(this, listviewid);
        listview.clear();
        listview.addAll(items);
    }

    addToListview(item, listviewid) {
        var listview = getListviewAdapter.call(this, listviewid);

        console.log("addToListview(): " + listview + "/" + item);
        listview.add(item);
    }

    updateInListview(itemid, item, listviewid) {
        var listview = getListviewAdapter.call(this, listviewid);

        console.log("updateInListview(): " + listview + "/" + item);

        listview.update(itemid, item);
    }

    removeFromListview(itemid, listviewid) {
        var listview = getListviewAdapter.call(this, listviewid);

        console.log("removeFromListview(): " + listview + "/" + itemid);
        listview.remove(itemid);
    }

    readFromListview(itemid, listviewid) {
        var listview = getListviewAdapter.call(this, listviewid);

        console.log("readFromListview(): " + listview + "/" + itemid);
        return listview.read(itemid);
    }

    getItemviewFromListview(itemid, listviewid) {
        var listview = getListviewAdapter.call(this, listviewid);

        console.log("getItemviewFromListview(): " + listview + "/" + itemid);
        return listview.getItemview(itemid);
    }

    readAllFromListview(itemid, listviewid) {
        var listview = getListviewAdapter.call(this, listviewid);

        console.log("readAllFromListview(): " + listview);
        return listview.elements;
    }

    /*
     * this is the default binding that uses templating with Ractive
     */
    bindListItemView(viewid, itemview, item, replacement) {
        console.log("bindListItemView(): " + viewid);
        applyDatabinding(replacement ? replacement.root : itemview.root, replacement ? replacement.body : itemview.body, item);

        // we replace the innerhtml content
        if (replacement) {
            itemview.innerHTML = replacement.root.innerHTML;
        }

        // we need to set the touchlisteners here, as content of itemview will have been created new
        touchEnableOffspring(replacement ? itemview : itemview.root);

        // for subtypes, we return the viewProxy
        return (replacement ? replacement.root.viewProxy : itemview.root.viewProxy);
    }

    /*
     * bind a dialog to data - by default, this will assume that we will be passed the dialog as a template segmented in root and body
     */
    bindDialog(dialogid, dialog, data) {
        console.log("bindDialog(): " + dialogid);
        applyDatabinding(dialog.root, dialog.body, data);
    }

    /*
     * we always pass ourselves as the owner
     */
    addListener(event,listener,runOnPaused) {
        eventhandling.addListener(event,listener,this,{runOnPaused: runOnPaused});
    }

    notifyListeners(event) {
        eventhandling.notifyListeners(event);
    }

    /* we do not want to expose status directly to the subtypes */
    markAsObsolete() {
        console.log("marking controller as obsolete: " + this.root.id);
        this.lcstatus = CONSTANTS.LIFECYCLE.OBSOLETE;
    }

    /*
     * this handles event listener callbacks
     */
    runEventListener(listener) {
        console.log("runEventListener(): for event: " + listener.boundEvent.desc());
        console.log("runEventListener(): lifecycle status is: " + this.lcstatus);

        switch (this.lcstatus) {
            case CONSTANTS.LIFECYCLE.SHOWING:
                console.log("runEventListener(): controller is running in the foreground. Execute listener...");
                listener.call();
                break;
            case CONSTANTS.LIFECYCLE.PAUSED:
                // check whether the listener has parameters set (which may cause immediate execution)
                if (listener.eventHandlerParams && listener.eventHandlerParams.runOnPaused) {
                    console.log("runEventListener(): controller is paused, but listener says runOnPaused. Run it...");
                    listener.call();
                }
                else {
                    console.log("runEventListener(): controller is paused. Will add listener to pending listeners...");
                    this.pendingEventListeners.push(listener);
                }
                break;
            case CONSTANTS.LIFECYCLE.CREATED:
                console.log("runEventListener(): controller has not been shown so far. There might be something wrong, but we will add listener to pending listeners...");
                break;
            default:
                console.log("runEventListener(): listener will not be handled at the current lifecycle phase: " + this.lcstatus);
        }

    }

    // global accessors

    setGlobal(key,value) {
        GLOBAL[key] = value;
    }

    hasGlobal(key) {
        return (GLOBAL[key] ? true : false);
    }

    getGlobal(key) {
        return GLOBAL[key];
    }

    removeGlobal(key) {
        delete GLOBAL[key];
    }

}

/*
 * extension for embedded view controllers that require additional functions
 */
class EmbeddedViewController extends ViewController {

    constructor() {
        super();
        this.parent = null;
    }

    async oncreate() {
        super.oncreate();
    }

    attachToView(view) {
        console.log("attaching component " + this.root.id + " to view: " + view.id);
        this.parent = view;
    }

    detachFromView() {
        if (this.parent) {
            console.log("detaching component " + this.root.id + " from current view");
        }
        else {
            console.log("component " + this.root.id + " is currently not attached.");
        }
    };

}

/*
 * generic implementation of a view controller that controls the usage of the side menu - subtypes only need to override the onMenuItemSelected() function
 */
class SidemenuViewController extends EmbeddedViewController {

    constructor() {
        super();

        // the action to open the menu
        this.mainmenuAction = null;
        // the event listeners that will result in showing and hiding the menu
        this.showMenu = null;
        this.hideMenu = null;
    }


    async oncreate() {
        console.log("SideMenuViewController.oncreate()");
        await super.oncreate();

        this.showMenu = (event) => {
            console.log("showMenu()");
            hideMenusAndDialogs.call(this);
            // REFACVIEWS
            // we probably need to attach it to the body
            document.body.appendChild(this.root);
            setTimeout(() => {
                    this.root.classList.add("mwf-expanded");
                    this.root.onclick = cancelClickPropagation;
                    // we must not propagate, otherwise this triggers the hideMenu listener...
                    event.stopPropagation();
                },100);
         };

        this.hideMenu = () => {
            console.log("hideMenu()");
            this.root.classList.remove("mwf-expanded");
        };

        // from the root we try to read out the menu items... something gets wrong here...
        var menuItems = this.root.getElementsByClassName("mwf-menu-item");
        console.log("found " + menuItems.length + " menu items");
        var i;
        for (i = 0; i < menuItems.length; i++) {
            console.log("setting listener on: " + menuItems[i].getAttribute("data-mwf-id"));
            menuItems[i].onclick = (event) => {
                if (event.currentTarget.classList.contains("mwf-menu-item")) {
                    this.onMenuItemSelected(event.currentTarget);
                }
            };
        }
    };

    async onresume() {
        console.log("SideMenuViewController.onresume()");
        super.onresume();
    }

    onMenuItemSelected(item) {
        console.log("SideMenuViewController.onMenuItemSelected(): " + item);
        console.log("SideMenuViewController.onMenuItemSelected(): id " + item.id + "/ mwf-id " + item.getAttribute("data-mwf-id"));
        var currentSelected = document.getElementsByClassName("mwf-selected");
        var i;
        for (i = 0; i < currentSelected.length; i++) {
            currentSelected[i].classList.remove("mwf-selected");
        }
        item.classList.add("mwf-selected");

        // check whether the item has a target specified - otherwise the item needs to be treated locally
        var targetVC = item.getAttribute("data-mwf-targetview");
        if (targetVC) {
            // the nextView will be started as a root view, i.e. all existing views will be removed
            this.nextView(targetVC, null, true);
        }
        else {
            mwfUtils.showToast("option " + item.getAttribute("data-mwf-id") + " is not supported yet!");
        }
    }

    // handle attachment
    attachToView(view) {
        console.log("SideMenuViewController: attachToView(): " + view);
        super.attachToView(view);

        // we lookup the mainmenu action from the view and attach to it
        var mainmenuActionElements = view.getElementsByClassName("mwf-img-sandwich-action");
        console.log("SideMenuViewController: found mainmenu elements: " + mainmenuActionElements.length);
        if (mainmenuActionElements.length == 0) {
            console.log("view " + view.id + " does not seem to use a mainmenu action");
        }
        else {
            // add the handler to open the menu
            this.mainmenuAction = mainmenuActionElements[0];
            this.mainmenuAction.addEventListener("click", this.showMenu);
            // add a handler to close the menu on the whole parent element (which will be partially hidden by ourselves)
            this.parent.addEventListener("click", this.hideMenu);
        }
    };

    // handle detachment, in this case, we set the mainmenuAction to null
    detachFromView() {
        super.detachFromView();

        // if on detaching, the menu is shown, we need to hide it
        if (this.root.classList.contains("mwf-expanded")) {
            this.hideMenu();
        }

        if (this.mainmenuAction) {
            this.mainmenuAction.removeEventListener("click", this.showMenu);
            this.parent.removeEventListener("click", this.hideMenu);
            this.mainmenuAction = null;
        }

    }

}

// REFACVIEWS:
// only active views will be part of the document
// we create a map of top-level elements that are identified by their id and will replace usages of
// getElementById by accesses to this map and lookup inside of the document as default
const topLevelViews = {};

let initialView = null;

function getTopLevelView(id) {

    console.debug("getTopLevelView(): " + id);

    if (topLevelViews[id]) {
        console.debug("getTopLevelView(): found: ",topLevelViews[id]);
        return topLevelViews[id];
    }
    const el = document.getElementById(id);

    if (el) {
        console.debug("getTopLevelView(): found in document: ",el);
        return el;
    }

    console.warn("getTopLevelView(): element with id " + id + " could not be found. Maybe it is a template, though.");

    return null;
}

function extractTopLevelViews() {

    console.log("extractTopLevelViews()");

    // we need to extract the dialogs from their views
    document.querySelectorAll(".mwf-dialog").forEach(e => {
        if (e.id) {
            console.debug("extractTopLevelViews(): found dialog: " + e.id);
            topLevelViews[e.id] = e;
            e.parentNode.removeChild(e);
        }
        else {
            console.warn("extractTopLevelViews(): found dialog element without id: ", e);
        }
    });

    document.querySelectorAll("body > div").forEach(e => {
        if (e.id) {
            console.debug("extractTopLevelViews(): found top level view: " + e.id);
            topLevelViews[e.id] = e;
            e.parentNode.removeChild(e);
            if (e.classList.contains("mwf-view-initial")) {
                console.log("extractTopLevelViews(): found initial view: ", initialView);
                initialView = e;
            }
        }
        else {
            console.info("extractTopLevelViews(): found element without id: ", e);
            if (e.classList.contains("mwf-view-initial")) {
                console.log("extractTopLevelViews(): element is initial view: ", initialView);
                initialView = e;
            }
        }
    });

    console.log("extractTopLevelViews(): found " + Object.keys(topLevelViews).length + " top level view elements, including dialogs...");
}

/*
 * application superclass, holds shared resources, and subclasses may implement shared logics
 */
class Application {

    constructor() {
        console.log("Application: constructor()");
        this.CRUDOPS = {};
        this.CRUDOPS.LOCAL = "local";
        this.CRUDOPS.REMOTE = "remote";
        this.CRUDOPS.SYNCED = "synced";

        this.bodyElement = null;

        this.initialView = null;

        this.currentCRUDScope = null;

        this.crudops = {};
    }

    async oncreate() {
        console.log("oncreate()");

        // REFACVIEWS
        // var initialViews = this.bodyElement.getElementsByClassName("mwf-view-initial");
        // if (initialViews.length == 0) {
        //     mwfUtils.showToast("No initial view could be found!");
        // } else {
        //     this.initialView = initialViews[0];
        //     console.log("Application.oncreate(): determined initialView: " + this.initialView.id);
        // }

        if (!initialView) {
            mwfUtils.showToast("No initial view could be found!");
        } else {
            this.initialView = initialView;
            console.log("Application.oncreate(): determined initialView: " + this.initialView.id);
        }

    }

    registerEntity(entitytype,entitytypedef,notify) {
        console.log("registerEntity(): " + entitytype);

        var typecrudops = this.crudops[entitytype];
        if (!typecrudops) {
            typecrudops = {};
            this.crudops[entitytype] = typecrudops;
        }
        typecrudops.typedef = entitytypedef;
        typecrudops.notify = notify;
    }

    registerCRUD(entitytype,scope,impl) {
        console.log("registerCRUD(): crudops declaration for " + entitytype + " in scope " + scope);

        var typecrudops = this.crudops[entitytype];
        if (!typecrudops) {
            typecrudops = {};
            this.crudops[entitytype] = typecrudops;
        }
        typecrudops[scope] = impl;
    }

    initialiseCRUD(scope,em) {
        if (!em) {
            em = EntityManager;
        }

        console.log("initialiseCRUD(): crudops declaration is: " + mwfUtils.stringify(this.crudops));

        var entitytype, crudopsdecl, impl;
        for (entitytype in this.crudops) {
            crudopsdecl = this.crudops[entitytype];
            impl = crudopsdecl[scope];
            if (!impl) {
                console.error("initialiseCRUD(): could not find impl for entitytype " + entitytype + " in scope " + scope + ".This will not work!");
            }
            else {
                console.log("initialiseCRUD(): initialising impl for entitytype " + entitytype + " in scope: " + scope);
                em.addCRUD(entitytype,impl,crudopsdecl.typedef,crudopsdecl.notify);
            }
        }
        this.currentCRUDScope = scope;
    }

    switchCRUD(scope,em) {

        if (!em) {
            em = EntityManager;
        }

        var entitytype;
        for (entitytype in this.crudops) {
            this.switchCRUDForType(entitytype,scope,em);
        }
        this.currentCRUDScope = scope;
    }

    switchCRUDForType(entitytype,scope,em) {
        if (!em) {
            em = EntityManager;
        }

        var impl = this.crudops[entitytype][scope];
        if (!impl) {
            console.warn("switchCRUDForType(): could not find impl for entitytype " + entitytype + " in scope " + scope + ". Will not change existing impl");
        }
        else {
            console.log("switchCRUDForType(): switching impl for entitytype " + entitytype + " to scope: " + scope);
            em.resetCRUD(entitytype,impl);
        }
    }

    // allow to broadcast events from the application
    notifyListeners(event) {
        eventhandling.notifyListeners(event);
    }

};


// this is the initial method that will be called when the document and all scripts have been loaded
function onloadApplication() {
    console.log("onload()");

    // check whether we have any element marked as mwf-styling, in which case we just cut all elements and add the one to be styled, marking mwf-shown
    // the array returned by querySelectorAll will keep the elements regardless of whether they are removed from the body or not
    var stylingElements = document.querySelectorAll(".mwf-styling");
    if (stylingElements.length > 0) {
        console.info("application is running in styling mode. All elements from body will be removed apart from the ones marked as mwf-styling");
        var body = document.getElementsByTagName("body")[0];
        while (body.firstChild) {
            body.removeChild(body.firstChild);
        }
        body.classList.remove("mwf-loading-app");
        console.log("adding " + stylingElements.length + " styling elements to body");
        var i, stylingEl;
        for (i=0;i<stylingElements.length;i++) {
            stylingEl = stylingElements[i];
            // append the first element out of the list
            if (stylingEl.classList.contains("mwf-view")) {
                stylingEl.classList.add("mwf-currentview");
            }
            body.appendChild(stylingEl);
        }
    }
    else {
        console.log("application is running in runtime mode");

        // check whether the application contains embedded templates and output an error
        var embeddedTemplates = document.querySelectorAll(".mwf-template .mwf-template");
        if (embeddedTemplates.length == 0) {
            console.log("embedded templates check sucessful. None was found.");
        }
        else {
            var templatesmsg = "";
            var j;
            for (j = 0; j < embeddedTemplates.length; j++) {
                templatesmsg += embeddedTemplates[j].tagName + "[" + embeddedTemplates[j].getAttribute("data-mwf-templatename") + "]: " + embeddedTemplates[j].getAttribute("class") +"\n";
            }
            alert("ERROR: application contains embedded templates! This will cause trouble!:\n\n " + templatesmsg);
        }

        // first of all, we mark the body as loading - this would allow showing, e.g., some splash screen
        document.querySelector("body").classList.add("mwf-loading-app");

        // we first of all set all views to idle
        var views = document.getElementsByClassName("mwf-view");
        var k;
        for (k = 0; k < views.length; k++) {
            views[k].classList.add("mwf-idle");
        }

        touchEnableOffspring(document);

        // then we initialise the application state
        applicationState = new ApplicationState();
        applicationResources = new ApplicationResources();


        // instantiate the top level view controllers (which are children of the root element)
        var embeddedComponents = document.querySelectorAll("body > .mwf-view-component");

        console.log("found " + embeddedComponents.length + " top level components!");
        var m, currentComponentViewControllerClassname,  currentComponentViewControllerFunction, currentComponentViewController;
        for (m = 0; m < embeddedComponents.length; m++) {
            currentComponentViewControllerClassname = embeddedComponents[m].getAttribute("data-mwf-viewcontroller");
            console.log("loading top level embedded view controller: " + currentComponentViewControllerClassname);
            // check whether the controller is attaching or not

            // load and instantiate the controller
            currentComponentViewControllerFunction = thisapp[currentComponentViewControllerClassname];//require(currentComponentViewControllerClassname);
            //console.log("currentComponent function: " + currentComponentViewControllerFunction);

            currentComponentViewController = new currentComponentViewControllerFunction();

            if (embeddedComponents[m].classList.contains("mwf-attaching")) {
                currentComponentViewController.mwfAttaching = true;
            }

            // set view
            currentComponentViewController.setViewAndArgs(embeddedComponents[m]);

            // call oncreate if it specifies mwf-initialise-onload
            // attach to the initialView will be done inside of the pushViewController function
            if (embeddedComponents[m].classList.contains("mwf-initialise-onload")) {
                currentComponentViewController.oncreate().then(function () {
                    applicationState.addEmbeddedController(currentComponentViewController);
                });
            }
            else {
                applicationState.addEmbeddedController(currentComponentViewController);
            }
        }

        // we extract the templates here in order not to get in conflict with the embedded view controllers
        applicationResources.extractTemplates();

        // REFACVIEWS
        extractTopLevelViews();

        // TODO: we might add more of the above processing into the application?

        // now instantiate the application
        var bodyEl = document.getElementsByTagName("body")[0];
        var applicationClassname = bodyEl.getAttribute("data-mwf-application");
        if (applicationClassname) {
            console.info("onLoadApplication(): using custom application: " + applicationClassname);
            // the application will be realised as a singleton!
            applicationObj = thisapp[applicationClassname];//require(applicationClassname);
        }
        else {
            console.warn("onLoadApplication(): no custom application is specified. Use default implementation.");
            applicationObj = new Application();
        }

        console.log("created applicationObj: ", applicationObj);

        // set the body element on the application
        applicationObj.bodyElement = bodyEl;

        // we run oncreate on the application
        applicationObj.oncreate().then(function () {

            var initialView = applicationObj.initialView;

            // detetermine which view controller we shall use initially
            var initialViewControllerClassname = initialView.getAttribute("data-mwf-viewcontroller");
            console.log("using initial view controller: " + initialViewControllerClassname);

            var initialViewControllerFunction = thisapp[initialViewControllerClassname];//require(initialViewControllerClassname);
            var initialViewController = new initialViewControllerFunction();

            initialViewController.application = applicationObj;
            initialViewController.setViewAndArgs(initialView);
            console.log("after setting view and args, root is: " + initialViewController.root);

            // here, loading is finished
            document.querySelector("body").classList.remove("mwf-loading-app");
            document.querySelector("body").classList.add("mwf-loaded-app");

            // we set a listener that reacts to changes of the window location
            // comment because this is blocked by the browsers
            // window.onbeforeunload = function () {
            //     confirm("Do you really want to leave this app?");
            // };

            // push the initial view controller to the application state
            applicationState.pushViewController(initialViewController);
        });

    }

}

function retrieveAncestor(el,tagName) {
    if (!el.parentNode) {
        return null;
    }
    else if (el.parentNode.tagName == tagName) {
        return el.parentNode;
    }
    else {
        return retrieveAncestor(el.parentNode,tagName);
    }
}

const stringify = mwfUtils.stringify;
const Event = eventhandling.Event;
const segmentTypedId = EntityManager.segmentId;
const xtends = mwfUtils.xtends;

export {
    Application,
    ApplicationState,
    ViewController,
    EmbeddedViewController,
    SidemenuViewController,
    ApplicationResources,
    onloadApplication,
    applyDatabinding,
    stringify,
    // also pass the event constructor
    Event,
    EventMatcher,
    segmentTypedId,
    xtends
};


