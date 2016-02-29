/**
 * @author Jörn Kreutel
 *
 * TODO: when adding a tag without saving the object, tag list creation may not work correctly. It might be better to undo all changes once leaving the view without saving!
 */
define(["mwf","mwfUtils","entities","mapHolder"], function(mwf, mwfUtils,entities,mapHolder) {

    function PlacesEditviewViewController() {
        console.log("PlacesEditviewViewController()");

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = PlacesEditviewViewController.prototype;

        // the view proxy
        var viewProxy;

        // the object that is dealt with by this view
        var placeItem;

        /*
         * for any view: initialise the view
         */
        this.oncreate = function (callback) {
            // as the whole view is a template we need to first create it before calling oncreate on superclass, otherwise generic elements will not be initialised.

            console.log("oncreate() args: " + mwf.stringify(this.args) + "/" + this.root);
            placeItem = this.args.item;

            // we bind to the root element
            viewProxy = this.bindElement("placesEditviewTemplate", {item: placeItem}, this.root).viewProxy;

            // attention! if the callback specified in the template does not exist, no error will be thrown!
            viewProxy.bindAction("pasteDefaultContent", function () {
                placeItem.content = defaultContent;
                viewProxy.update({item: placeItem});
            }.bind(this));
            this.root.querySelector("[data-mwf-id='deletePlaceAction']", function () {
                if (placeItem.created) {
                    placeItem.delete(function () {
                        console.log("deletePlace() finished.");
                        // return to the previous view
                        this.previousView();
                    }.bind(this))
                }
                // if we are in create mode, we just return
                else {
                    this.previousView();
                }
            }.bind(this));
            viewProxy.bindAction("addTag", function () {
                this.showDialog("selectTagDialog", {tagableItem: placeItem, receiverId: this.root.id});
            }.bind(this));

            // deal with form submission
            viewProxy.bindAction("submitPlaceForm", function (event) {


                if (!placeItem.created) {
                    // create a new places item and return to the previous view
                    placeItem.create(function () {
                        console.log("submitPlace(): object created.");
                        this.previousView();
                    }.bind(this));
                }
                else {
                    placeItem.update(function () {
                        console.log("sumitPlace(): object updated: " + mwf.stringify(placeItem));
                        this.previousView();
                    }.bind(this));
                }

                return false;
            }.bind(this));

            // we bind the two actions which might be received by the elements in the taglist
            viewProxy.bindAction("selectTag", function (event) {
                event.original.stopPropagation();
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("selectTag: " + tagid);
                var tag = placeItem.getTag(tagid);
                this.nextView("taggableOverview", {item: tag});
            }.bind(this));
            viewProxy.bindAction("removeTag", function (event) {
                event.original.stopPropagation();
                // obtain the tagid
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("removeTag with id: " + tagid);
                // lookup the tag
                var tag = placeItem.getTag(tagid);
                console.log("removeTag: " + tag);
                this.showDialog("removeTagDialog", {
                    tag: tag,
                    actionBindings: {
                        okAction: function () {
                            placeItem.removeTag(tag);
                            refreshView.call(this);
                            this.hideDialog();
                        }.bind(this),
                        cancelAction: function () {
                            this.hideDialog();
                        }.bind(this)
                    }
                });
            }.bind(this));

            // register for the "added" ui event for tag in order to be able to refresh the view
            this.addListener(new mwf.EventMatcher("ui", "added", "Tag"), function (event) {
                if (event.data.receiverId == this.root.id) {
                    console.log("a tag was added. Refresh the view: " + mwf.stringify(this.args));
                    refreshView.call(this);
                }
                else {
                    console.log("a tag was added, but " + this.root.id + " is not addressed: " + event.data.receiverId);
                }
            }.bind(this));

            // TODO: call the superclass function and pass the callback
            proto.oncreate.call(this, callback);
        }

        function refreshView() {
            viewProxy.update(this.args);
        }

        this.onresume = function (callback) {

            // call the superclass method and pass a callback bound to this
            proto.onresume.call(this, function () {

                mapHolder.attach(this.root.querySelector(".mwf-mapcontainer"));

                map = mapHolder.createMap(true,{zoom:17, latlong: [52.512764, 13.453245]});

                if (callback) {
                    callback();
                }

            }.bind(this));

        }
    }

    // extend the view controller supertype
    mwf.xtends(PlacesEditviewViewController,mwf.ViewController);

    // and return the view controller function
    return PlacesEditviewViewController;
});
