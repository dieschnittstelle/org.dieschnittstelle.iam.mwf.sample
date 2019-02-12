/**
 * @author Jörn Kreutel
 *
 * TODO: when adding a tag without saving the object, tag list creation may not work correctly. It might be better to undo all changes once leaving the view without saving!
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";
import {mapHolder} from "../Main.js";

export default class PlacesEditviewViewController extends mwf.ViewController {

    constructor() {
        console.log("PlacesEditviewViewController()");
        super();

        // the view proxy
        this.viewProxy = null;

        // the object that is dealt with by this view
        this.placeItem = null;

        // this controller handels both view and edit mode and allows to switch between them
        this.mode = "view";

        // the map
        this.map = null;

        // we foresee an attribute for the mapclick function
        this.onmapclick = null;
    }

    /*
     * for any view: initialise the view
     */
    async oncreate() {
        // as the whole view is a template we need to first create it before calling oncreate on superclass, otherwise generic elements will not be initialised.

        console.log("oncreate() args: " + mwf.stringify(this.args) + "/" + this.root);

        if (this.args && this.args.mode) {
            console.log("mode is specified in args: " + this.args.mode);
            this.mode = this.args.mode;
        }
        else {
            console.log("no mode specified in args. Use view mode");
        }

        this.placeItem = this.args.item;

        // we bind to the root element
        this.viewProxy = this.bindElement("placesEditviewTemplate", {item: this.placeItem, mode: this.mode}, this.root).viewProxy;

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

        this.viewProxy.bindAction("setEditMode", () => {
            this.setEditMode();
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
        super.oncreate();
    }

    refreshView() {
        this.viewProxy.update({item: this.placeItem, mode: this.mode});
    }

    /*
     * currently, the map we display here will differ depending on whether the map overview had been shown before or not
     * (if mapview was shown, all markers will be set)
     */
    async onresume() {

        // call the superclass method and pass a callback bound to this
        await super.onresume();

        mapHolder.attach(this.root.querySelector(".mwf-mapcontainer"));

        if (!this.placeItem.location) {
            this.placeItem.location = new entities.Location(52.512764, 13.453245);
        }

        this.map = mapHolder.createMap({zoom:(this.placeItem.created ? 17 : 13),location: this.placeItem});
        mapHolder.addMarker(this.placeItem);

        // prepare the input popup for changing locations

        // this element always needs to be initialised regardless of whether the map is initialised or not
        // for testing location selection from the map...
        var inputPopup = L.popup();
        var inputPopupContent = this.getTemplateInstance("placesEditviewMarkerPopup").root;
        console.log("template: ", inputPopupContent);

        this.onmapclick = (mapclick) => {
            console.log("onclick(): " + mapclick.latlng.lat + "/" + mapclick.latlng.lng);

            console.log("creating inputPopup...");

            inputPopupContent.onclick = () => {
                // this is a workaround, see https://leaflet.uservoice.com/forums/150880-ideas-and-suggestions-for-leaflet/suggestions/3272312-an-api-function-to-close-a-popup-at-the-moment-i
                inputPopup._close();
                console.log("inputPopupContent.onclick()")
                this.onConfirmInputLocation(mapclick.latlng);
            };

            inputPopup
                .setLatLng(mapclick.latlng)
                .setContent(inputPopupContent)
                .openOn(this.map);
        }

        // the input popup needs to be initialised for each usage of mapviewcontroller, otherwise this will point to the first controller instance for which the map was initialised...
        if (this.mode == "edit") {
            // TODO: need to check whether this results in multiple additions in case the controller is used more than once
            this.map.on("click", this.onmapclick);
        }

    }

    // this is for updating the view once a mode change has occurred
    onModeChanged() {
        console.log("onModeChanged(): mode is: " + this.mode);
        this.refreshView();
        // we need to change the mode of the map
        if (this.mode == "edit") {
            this.map.on("click",this.onmapclick);
        }
        else {
            this.map.off("click",this.onmapclick);
        }
    }

    setEditMode() {
        this.mode = "edit";
        this.onModeChanged();
    }

    onback() {
        // if we are in the edit mode, we will switch to the view mode unless the edit mode has been specified in the args
        if (this.mode == "edit" && (this.args ? this.args.mode != "edit" : true)) {
            console.log("onback(): we are in edit mode, just switch the mode");
            this.mode = "view";
            this.onModeChanged();
        }
        else {
            console.log("onback(): we are not in edit mode or edit mode has been passed as an argument. go back.");
            super.onback();
        }
    }

    // we make sure that when leaving the view the click listener is removed (and also the markers?)
    previousView() {
        this.map.off("click", this.onmapclick);
        super.previousView();
    }

    onConfirmInputLocation(latlng) {
        console.log("onConfirmInputLocation()");

        // we remove the existing marker
        mapHolder.removeMarker(this.placeItem);
        this.placeItem.location = new entities.Location(latlng.lat,latlng.lng);
        mapHolder.addMarker(this.placeItem);
    }
}

