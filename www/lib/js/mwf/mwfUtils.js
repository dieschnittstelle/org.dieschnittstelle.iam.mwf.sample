console.log("loading module...");

/*************
 * toasts
 *************/


function showToast(text, duration) {
    console.log("showToast()");

    // access the toast element
    var toast = document.querySelector(".mwf-toast");
    toast.textContent = text;
    toast.classList.toggle("mwf-active");
    setTimeout(function () {
        toast.classList.toggle("mwf-active");
    }, duration || 3500);
}

/*************
 * longpress
 *************/

    // we use a timer variable to detect whether we had a longpress
var timer;

function startLongpressReco(element, timeout, event, onLongPress) {
    console.log("startLongpressReco(): " + event);
    // we block propagation
    event.stopPropagation();
    // then we set the timeout for calling longPress handling
    timer = window.setTimeout(function () {
        // we invoke this function that must be provided by the view that uses the longpress handler - i.e. it is a global callback function with a fixed name
        // this does not really work anymore, allow to pass a function...
        if (onLongPress) {
            onLongPress(element);
        } else {
            showToast("longpress occurred!");
        }
    }, timeout);
}

function cancelLongpressReco() {
    console.log("cancelLongpressReco()");
    window.clearTimeout(timer);
}

// we create the functions to be called
var startReco = function (event) {
    startLongpressReco(this, 1000, event);
};
var cancelReco = function (event) {
    cancelLongpressReco();
};

/* enable longpress on an element */
function enableLongpress(element) {
    console.log("enabling longpress on: " + element);
    // set the function as arguments
    element.addEventListener("mousedown", startReco);
    element.addEventListener("touchstart", startReco);

    element.addEventListener("mouseup", cancelReco);
    element.addEventListener("mousemove", cancelReco);

    element.addEventListener("mousemove", cancelReco);
    element.addEventListener("touchmove", cancelReco);

    console.log("have set longpress handlers on element: " + element);
}

/***************
 * ui utilities
 ***************/

    // this seems to be sufficient for distinguising touch vs. scroll
var touchedcheckTimeout = 20;

/*
 * cut and paste elements
 */
function cutNpasteElement(element, target, insertBeforeId) {
    if (!insertBeforeId) {
        target.appendChild(element);
    } else {
        target.insertBefore(element, document.getElementById(insertBeforeId));
    }

    return element;
}

function cutNpasteElementByClassName(klass, target, insertBeforeId) {
    return cutNpasteElement(document.getElementsByClassName(klass)[0], target, insertBeforeId);
}

function cutNpasteElementById(id, target, insertBeforeId) {
    return cutNpasteElement(document.getElementById(id), target, insertBeforeId);
}

function clearNode(element) {
    var fc = element.firstChild;
    while (fc) {
        element.removeChild(fc);
        fc = element.firstChild;
    }
}

/*
 * handlers for touch events - cancel touch events on touchend/move or mouseup/move
 */
function cancelSelection(e) {
    // this conditional is pointless because we do not handle the event in the capturing phase - it might make sense, to acually HANDLE the event in the capturing phase, though...
    // if (e.eventPhase != Event.CAPTURING_PHASE) {
    e.stopPropagation();

    if (e.currentTarget.classList.contains("mwf-touched") || e.currentTarget.classList.contains("mwf-touched-check")) {
        var touchedCandidate = e.currentTarget;
        console.log("cancelSelection(): removing touched handling from element",touchedCandidate);
        touchedCandidate.classList.remove("mwf-touched");
        touchedCandidate.classList.remove("mwf-touched-check");

        touchedCandidate.removeEventListener("mousedown", cancelSelection);
        touchedCandidate.removeEventListener("mousemove", cancelSelection);
        touchedCandidate.removeEventListener("touchmove", cancelSelection);
        touchedCandidate.removeEventListener("touchcancel", cancelSelection);
        touchedCandidate.removeEventListener("touchend", cancelSelection);
    }
    // else {
    //     console.log("cancelSelection(): no touched element found");
    // }
    // }
}

function feedbackTouchOnElement(element) {

    /* mouse */
    element.addEventListener("mousedown", function (e) {
        if (e.eventPhase != Event.CAPTURING_PHASE) {
            console.log("mousedown: " + element + " in phase: " + e.eventPhase);
            e.stopPropagation();

            element.classList.add("mwf-touched-check");

            element.addEventListener("mouseup", cancelSelection);
            element.addEventListener("mousemove", cancelSelection);

            setTimeout(function () {
                if (element.classList.contains("mwf-touched-check")) {
                    console.log("mousedown: add mwf-touched to element with mwf-id " + element.getAttribute("data-mwf-id"));
                    element.classList.remove("mwf-touched-check");
                    element.classList.add("mwf-touched");
                }
            }, touchedcheckTimeout);
        }
    });

    /* touch */
    element.addEventListener("touchstart", function (e) {
        if (e.eventPhase != Event.CAPTURING_PHASE) {
            console.log("touchstart: " + element);
            e.stopPropagation();

            element.classList.add("mwf-touched-check");

            element.addEventListener("touchmove", cancelSelection);
            element.addEventListener("touchcancel", cancelSelection);
            element.addEventListener("touchend", cancelSelection);

            setTimeout(function () {
                if (element.classList.contains("mwf-touched-check")) {
                    console.log("touchstart: add mwf-touched to element with mwf-id " + element.getAttribute("data-mwf-id"));
                    element.classList.remove("mwf-touched-check");
                    element.classList.add("mwf-touched");
                }
            }, touchedcheckTimeout);
        }
    });
}

function removeTouch(element) {
    element.classList.remove("mwf-touched");
    element.classList.remove("mwf-touched-check");
}

/*
 * check whether some input has been completed by setting a timestamp and checking whether it has changed or not after some timeout
 */
function checkInputCompleted(timeout, callback, event) {
    var time = Date.now();
    event.target.setAttribute("data-mwf-last-input", time);
    setTimeout(function () {
        if (event.target.getAttribute("data-mwf-last-input") == time) {
            console.log("inputCompletedListener: no further input occurred after last input. Fire callback");
            callback.call(this);
        } else {
            //console.log("inputCompletedListener: after timeout, data-mwf-last-input has changed: " + time + " vs. " + event.target.getAttribute("data-mwf-last-input"));
        }
    }.bind(this), timeout);
}

/*
 * some other utitilities
 */

function startsWith(string, substring) {
    return string.indexOf(substring) == 0;
}

function endsWith(string, substring) {
    return string.length >= substring.length && string.substring(string.length - substring.length) == substring;
}

function substringAfter(string, substring) {
    if (string.indexOf(substring) > -1) {
        return string.substring(string.indexOf(substring) + substring.length);
    }
    return string;
}

function substringBefore(string, substring) {
    if (string.indexOf(substring) > -1) {
        return string.substring(0, string.indexOf(substring));
    }
    return string;
}

/*
 * OO
 */
// extend some supertype
function xtends(subtype, supertype) {
    // set the supertype as prototype (which results in also replacing the constructor)
    subtype.prototype = new supertype();
    // re-set the constructor to the subtype
    subtype.prototype.constructor = subtype;

    // see for the issues related to this solution, e.g.: http://stackoverflow.com/questions/4152931/javascript-inheritance-call-super-constructor-or-use-prototype-chain
    // however, without instantiating the supertype, public functions declared inside the supertype constructor functions, rather than via prototype.functionname, will not be available on the prototype object
    // changing this should not be a big deal, though, as most abstract components (most prominently ViewController) declare their public functions as prototype functions
}

function stringifyObj(obj) {
    var str = "";
    var i;

    if (obj == null) {
        str += "null";
    } else if (obj == undefined) {
        str += "undefined";
    } else if (obj && obj.toPojo) {
        //console.log("stringify: entity");

        str += stringifyObj(obj.toPojo());
    }
    else if (Array.isArray(obj)) {
        //console.log("stringify: array");
        str = "[";
        for (i=0;i<obj.length;i++) {
            str += stringifyObj(obj[i]);
            if (i< (obj.length-1)) {
                str += ", ";
            }
        }
        str += "]";
    }
    else if (typeof obj == "object") {
        //console.log("stringify: object");
        str += "{";
        var length = Object.keys(obj).length;
        i=0;
        var attr;
        for (attr in obj) {
            str += (attr + "=");
            str += stringifyObj(obj[attr]);
            if (i < (length-1)) {
                str += ", ";
            }
            i++;
        }
        str += "}";
    }
    else if (typeof obj == "string" && startsWith(obj,"data")) {
        //console.log("stringify: dataUrl");
        str += "(dataUrl disclosed)";
    }
    else if (typeof obj == "function") {
        //console.log("stringify: function");
        str += "(function disclosed)";
    }
    else {
        //console.log("stringify: default");
        str += obj;
    }

    return str;
}

function createPersistableClone(obj) {
    var clone = {};
    var attr, currentVal;
    for (attr in obj) {
        currentVal = obj[attr];
        if (attr != "_id" && typeof currentVal != "function") {
            clone[attr] = currentVal;
        }
    }
    return clone;
}

function isWebserverAvailable(callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            console.log("isWebserverAvailable(): readyState: 4. Check status...");
            if (xhr.status == 204) {
                console.log("isWebserverAvailable(): success status: 204");
                callback(true);
            } else if (xhr.status == 0) {
                console.log("isWebserverAvailable(): offline status: 0");
                callback(false);
            } else {
                console.log("isWebserverAvailable(): error status: " + xhr.status + " - assume the server is offline");
                callback(false);
            }
        } else {
            console.log("isWebserverAvailable(): readyState: " + xhr.readyState);
        }
    };
    xhr.open("GET","/available");
    xhr.send();
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export {
    showToast,
    enableLongpress,
    startLongpressReco,
    cutNpasteElementByClassName,
    cutNpasteElementById,
    cutNpasteElement,
    feedbackTouchOnElement,
    clearNode,
    endsWith,
    startsWith,
    substringBefore,
    substringAfter,
    xtends,
    checkInputCompleted,
    removeTouch,
    stringifyObj as stringify,
    createPersistableClone,
    isWebserverAvailable,
    timeout
};


