/**
 * @author Jörn Kreutel
 */
import {mwf} from "../../framework-modules.js";

export default function GenericDialogTemplateViewController() {
    console.log("GenericDialogTemplateViewController()");

    // declare a variable for accessing the prototype object (used für super() calls)
    var proto = GenericDialogTemplateViewController.prototype;

    /*
     * in onresume we set the action callbacks
     */
    this.onresume = function (callback) {
        // do databinding, set listeners, initialise the view
        console.log("root: " + this.root);
        console.log("viewProxy: " + this.root.viewProxy);

        // we will be passed arguments that specify action bindings
        if (!this.args.actionBindings) {
            console.warn("no actionBindings passed to handle actions in template: " + this.root.getAttribute("data-mwf-templatename"));
        } else {
            var action;
            for (action in this.args.actionBindings) {
                console.log("adding binding for action: " + action);
                this.root.viewProxy.bindAction(action,this.args.actionBindings[action]);
            }
        }

        // call the superclass once creation is done
        proto.onresume.call(this,callback);
    };

}

// extend the view controller supertype
mwf.xtends(GenericDialogTemplateViewController,mwf.EmbeddedViewController);

