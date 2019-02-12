/**
 * @author Jörn Kreutel
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";

console.log("loading module...");

export default class TagsOverviewViewController extends mwf.ViewController {

    constructor() {
        console.log("TagsOverviewViewController");
        super();
    }

    /*
     * initialise the view oncreate
     */
    async oncreate() {
        await super.oncreate();

        // initialise the add action
        document.getElementById("newTagAction").onclick = (event) => {
            this.showDialog("editTagDialog",new entities.Tag());
        };

        // set listener for the crud events (new tags may also be created by the selection dialog)
        this.addListener(new mwf.EventMatcher("crud","created","Tag"),(event) => {
            this.addToListview(event.data);
        });
        this.addListener(new mwf.EventMatcher("crud","updated","Tag"),(event) => {
            this.updateInListview(event.data._id,event.data);
        });
        this.addListener(new mwf.EventMatcher("crud","deleted","Tag"),(event) => {
            this.removeFromListview(event.data);
        });
        // we also listen to the change of the crudops
        this.addListener(new mwf.EventMatcher("crud","changedScope"),(event) => {
            console.log("scope of crudops has changed. Reload entities and refresh listview...");
            entities.Tag.readAll((tags) => {
                this.initialiseListview(tags);
            });
        });

        entities.Tag.readAll((tags) => {
            this.initialiseListview(tags);
        });

    }

    /*
     * create the view for a list item
     */
    //this.bindListItemView = function (viewid, itemview, item) {
    //    console.log("bindListItemView(): " + item.name);
    //    itemview.querySelector("h2").textContent = "#" + item.name;
    //}

    /*
     * bind the edit dialog - note that dialog will be template of the form {root:..., body:...}
     */
    bindDialog(dialogid,dialog,item) {
        // first call the superclass to instantiate the dialog
        super.bindDialog(dialogid,dialog,item);
        // listen to form submission
        dialog.root.querySelector("#tagNameInputForm").onsubmit = (event) => {
            console.log("submit()");

            // if we use bidirectional data binding, we will always receice an item whose attributes will be bound to the values input by the user
            // if a new item shall be created, it will not have been assigned an id yet
            if (item.created) {
                console.log("will update item: " + mwf.stringify(item));
                item.update(() => {
                    console.log("submitTag(): update finished.");
                });
            }
            else {
                console.log("will create new item: " + mwf.stringify(item));
                item.create(() => {
                    console.log("submitTag(): create finished.");
                });
            }

            this.hideDialog();

            return false;
        };


        // listen to item deletion
        dialog.root.querySelector("#deleteTagAction").onclick = (event) => {
            item.delete(() => {
                console.log("deleteTag(): finished.");
            });

            this.hideDialog();
        };
    }

    /*
     * react to the listitem menu action - in fact, we do not display a menu, but right aways the edit dialog
     */
    onListItemMenuSelected(liitem) {
        console.log("onListItemMenuSelected(): " + JSON.stringify(item));

        // we need to retrieve the actual item object
        var item = this.readFromListview(liitem.getAttribute("data-mwf-id"));

        this.showDialog("editTagDialog",item);
    }

    /*
     * show the tag
     */
    showTag(tag) {
        console.log("showTag(): " + tag._id);
        this.nextView("taggableOverview",{item: tag});
    }

}

