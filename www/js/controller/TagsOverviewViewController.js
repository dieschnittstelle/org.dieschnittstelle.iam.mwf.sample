/**
 * @author Jörn Kreutel
 */
define(["mwf",  "mwfUtils", "entities"], function (mwf,  mwfUtils, entities) {
    console.log("loading module...");

    function TagsOverviewViewController() {

        var proto = TagsOverviewViewController.prototype;

        /*
         * initialise the view oncreate
         */
        this.oncreate = function (callback) {
            proto.oncreate.call(this, function () {

                // initialise the add action
                document.getElementById("newTagAction").onclick = function(event) {
                    this.showDialog("editTagDialog",new entities.Tag());
                }.bind(this);

                // set listener for the crud events (new tags may also be created by the selection dialog)
                this.addListener(new mwf.EventMatcher("crud","created","Tag"),function(event){
                    this.addToListview(event.data);
                }.bind(this));
                this.addListener(new mwf.EventMatcher("crud","updated","Tag"),function(event){
                    this.updateInListview(event.data._id,event.data);
                }.bind(this));
                this.addListener(new mwf.EventMatcher("crud","deleted","Tag"),function(event){
                    this.removeFromListview(event.data);
                }.bind(this));
                // we also listen to the change of the crudops
                this.addListener(new mwf.EventMatcher("crud","changedScope"),function(event){
                   console.log("scope of crudops has changed. Reload entities and refresh listview...");
                    entities.Tag.readAll(function (tags) {
                        this.initialiseListview(tags);
                    }.bind(this));
                }.bind(this));

                entities.Tag.readAll(function (tags) {
                    this.initialiseListview(tags);
                }.bind(this));

                callback();
            }.bind(this));
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
        this.bindDialog = function(dialogid,dialog,item) {
            // first call the superclass to instantiate the dialog
            proto.bindDialog.call(this,dialogid,dialog,item);
            // listen to form submission
            dialog.root.querySelector("#tagNameInputForm").onsubmit = function(event) {
                console.log("submit()");

                // if we use bidirectional data binding, we will always receice an item whose attributes will be bound to the values input by the user
                // if a new item shall be created, it will not have been assigned an id yet
                if (item._id > -1) {
                    console.log("will update item: " + mwf.stringify(item));
                    item.update(function() {
                        console.log("submitTag(): update finished.");
                    }.bind(this));
                }
                else {
                    console.log("will create new item: " + mwf.stringify(item));
                    item.create(function() {
                        console.log("submitTag(): create finished.");
                    }.bind(this));
                }

                this.hideDialog();

                return false;
            }.bind(this);


            // listen to item deletion
            dialog.root.querySelector("#deleteTagAction").onclick = function(event) {
                item.delete(function(){
                    console.log("deleteTag(): finished.");
                }.bind(this));

                this.hideDialog();
            }.bind(this);
        }

        /*
         * react to the listitem menu action - in fact, we do not display a menu, but right aways the edit dialog
         */
        this.onListItemMenuSelected = function (liitem) {
            console.log("onListItemMenuSelected(): " + JSON.stringify(item));

            // we need to retrieve the actual item object
            var item = this.readFromListview(liitem.getAttribute("data-mwf-id"));

            this.showDialog("editTagDialog",item);
        }

        /*
         * show the tag
         */
        this.showTag = function(tag) {
            console.log("showTag(): " + tag._id);
            this.nextView("taggableOverview",{item: tag});
        }

    }


    // we extend the generic vc for the side menu
    mwf.xtends(TagsOverviewViewController, mwf.ViewController);

    return TagsOverviewViewController;

});

