/**
 * @author Jörn Kreutel
 */

// we use the model from which we take the location type

import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";
import {mapHolder} from "../Main.js";

export default class MapViewController extends mwf.ViewController {

    constructor() {
        console.log("MapViewController()");
        super();

        // map view may be used for selecting / inputting a location
        this.enableInput = false;

        // the map
        this.map = null;
    }



    async oncreate() {
        console.log("oncreate()");

        await super.oncreate();

        if (this.args) {
            console.log("oncreate(): args: " + JSON.stringify(this.args));
            this.enableInput = this.args.enableInput;
        }
    }

    // onstop() {
    //    console.log("onstop()");
    //
    //    mapHolder.detach();
    //
    //    super.onstop();
    // }

    // initialisation must be done in onresume once the view is visible (which is not the case for oncreate)
    async onresume() {
        // call the superclass method and pass a callback bound to this
        await super.onresume();
        console.log("onresume(): args: " + JSON.stringify(this.args));

        // we use the mapHolder
        mapHolder.attach(this.root.getElementsByClassName("mwf-body")[0]);

        if (this.map == null) {

            this.map = mapHolder.createMap();

            // create the popup
            // we read out all places and add the items to the map
            entities.Place.readAll((places) => {
                console.log("read " + places.length + " places");
                places.forEach((p) => {
                    // create the popup
                    var popup = this.getTemplateInstance("placesOverviewMarkerPopup").root;
                    // we set the place name
                    popup.querySelector(".mwf-map-popup-content").textContent = p.name;
                    popup.onclick = () => {
                        this.map.closePopup();
                        this.nextView("placesEditview", {item: p, mode: "view"});
                    }
                    mapHolder.addMarker(p, popup);
                });
                mapHolder.arrange();
            });
        }
        else {
            mapHolder.arrange();
        }

    }

    onInputLocation(latlng) {
        // we return to the previous view passing the location information
        // we do not pass latlng directly, but use our own location type in order to abstract away from the concrete map framework
        console.log("onInputLocation(): " + (this.args ? JSON.stringify(this.args) : " no args"));

        this.previousView({item: this.args.item,location: new entities.Location(latlng.lat,latlng.lng)});
    }

    // add a marker
    // popup: optionally specify that no popup shall be realised (default is true)
    // layers: optionally specify one or more semantic layers to which it will be added (providing the name of the layer)
    // how to deal with replacements of items?
    // see http://leafletjs.com/examples/layers-control.html, but we could hide this functionality
    addMarkerForLocationItem(locItem,popup,layers) {

    }

    bindMarkerPopupToLocationItem(popupHtmlText,locItem) {

    }

    removeMarkerLayer(layer) {

    }

    onMarkerPopupSelected(locItem) {

    }

}
