/**
 * @author Jörn Kreutel
 *
 * TODO: when adding a tag without saving the object, tag list creation may not work correctly. It might be better to undo all changes once leaving the view without saving!
 */
define(["mwf","mwfUtils","entities","mapHolder"], function(mwf, mwfUtils,entities,mapHolder) {

    class PlacesEditviewViewController extends mwf.ViewController {

        constructor() {
            console.log("PlacesEditviewViewController()");
            super();

            // the view proxy
            this.viewProxy = null;

            // the object that is dealt with by this view
            this.placeItem = null;
        }

        /*
         * for any view: initialise the view
         */
        oncreate(callback) {
            // as the whole view is a template we need to first create it before calling oncreate on superclass, otherwise generic elements will not be initialised.

            console.log("oncreate() args: " + mwf.stringify(this.args) + "/" + this.root);
            this.placeItem = this.args.item;

            // we bind to the root element
            this.viewProxy = this.bindElement("placesEditviewTemplate", {item: this.placeItem}, this.root).viewProxy;

            // attention! if the callback specified in the template does not exist, no error will be thrown!
            this.viewProxy.bindAction("pasteDefaultContent", () => {
                this.placeItem.content = defaultContent;
                this.viewProxy.update({item: this.placeItem});
            });
            this.root.querySelector("[data-mwf-id='deletePlaceAction']", () => {
                if (this.placeItem.created) {
                    this.placeItem.delete(() => {
                        console.log("deletePlace() finished.");
                        // return to the previous view
                        this.previousView();
                    });
                }
                // if we are in create mode, we just return
                else {
                    this.previousView();
                }
            });
            this.viewProxy.bindAction("addTag", () => {
                this.showDialog("selectTagDialog", {tagableItem: this.placeItem, receiverId: this.root.id});
            });

            // deal with form submission
            this.viewProxy.bindAction("submitPlaceForm", (event) => {


                if (!this.placeItem.created) {
                    // create a new places item and return to the previous view
                    this.placeItem.create(() => {
                        console.log("submitPlace(): object created.");
                        this.previousView();
                    });
                }
                else {
                    this.placeItem.update(() => {
                        console.log("sumitPlace(): object updated: " + mwf.stringify(this.placeItem));
                        this.previousView();
                    });
                }

                return false;
            });

            // we bind the two actions which might be received by the elements in the taglist
            this.viewProxy.bindAction("selectTag", (event) => {
                event.original.stopPropagation();
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("selectTag: " + tagid);
                var tag = this.placeItem.getTag(tagid);
                this.nextView("taggableOverview", {item: tag});
            });
            this.viewProxy.bindAction("removeTag", (event) => {
                event.original.stopPropagation();
                // obtain the tagid
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("removeTag with id: " + tagid);
                // lookup the tag
                var tag = this.placeItem.getTag(tagid);
                console.log("removeTag: " + tag);
                this.showDialog("removeTagDialog", {
                    tag: tag,
                    actionBindings: {
                        okAction: () => {
                            this.placeItem.removeTag(tag);
                            this.refreshView();
                            this.hideDialog();
                        },
                        cancelAction: () => {
                            this.hideDialog();
                        }
                    }
                });
            });

            // register for the "added" ui event for tag in order to be able to refresh the view
            this.addListener(new mwf.EventMatcher("ui", "added", "Tag"), (event) => {
                if (event.data.receiverId == this.root.id) {
                    console.log("a tag was added. Refresh the view: " + mwf.stringify(this.args));
                    this.refreshView();
                }
                else {
                    console.log("a tag was added, but " + this.root.id + " is not addressed: " + event.data.receiverId);
                }
            });

            // TODO: call the superclass function and pass the callback
            super.oncreate(callback);
        }

        refreshView() {
            this.viewProxy.update(this.args);
        }

        onresume(callback) {

            // call the superclass method and pass a callback bound to this
            super.onresume(() => {

                mapHolder.attach(this.root.querySelector(".mwf-mapcontainer"));

                map = mapHolder.createMap(true,{zoom:17, latlong: [52.512764, 13.453245]});

                if (callback) {
                    callback();
                }

            });

        }
    }

    // and return the view controller function
    return PlacesEditviewViewController;
});
