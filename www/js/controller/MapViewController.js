/**
 * @author Jörn Kreutel
 */

// we use the model from which we take the location type
// TODO: organise this differently
define(["mwf","mwfUtils","entities","mapHolder"], function(mwf, mwfUtils,entities,mapHolder) {

    function MapViewController() {
        console.log("MapViewController()");

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = MapViewController.prototype;

        // map view may be used for selecting / inputting a location
        var enableInput = false;

        // the marker layers (a layer is a mapping from a string to an array of locationItem Ids) - TODO: check whether leaflet provides their own layering mechanism!
        var markerLayers;
        // locationItems contains a mapping from mapview-ids of locationItems to objects of the form {item:...,popup:...}, where item is a locationItem and popup the popup for this item
        var locationItems;

        this.oncreate = function(callback) {
            console.log("oncreate()");

            proto.oncreate.call(this,function(){

                console.log("oncreate()");

                if (this.args) {
                    console.log("oncreate(): args: " + JSON.stringify(this.args));
                    enableInput = this.args.enableInput;
                };

                callback();
            }.bind(this));
        }

        //this.onstop = function(callback) {
        //    console.log("onstop()");
        //
        //    mapHolder.detach();
        //
        //    proto.onstop.call(this,callback);
        //}

        // initialisation must be done in onresume once the view is visible (which is not the case for oncreate)
        this.onresume = function (callback) {
            // call the superclass method and pass a callback bound to this
            proto.onresume.call(this,function(){
                console.log("onresume(): args: " + JSON.stringify(this.args));

                // we use the mapHolder
                mapHolder.attach(this.root.getElementsByClassName("mwf-body")[0]);
                var map = mapHolder.createMap(true);

                // this element always needs to be initialised regardless of whether the map is initialised or not
                // for testing location selection from the map...
                var inputPopup = L.popup();
                var inputPopupContent = document.createElement("a");
                inputPopupContent.classList.add("mwf-map-popup-content");

                // the input popup needs to be initialised for each usage of mapviewcontroller, otherwise this will point to the first controller instance for which the map was initialised...
                if (enableInput) {
                    // TODO: need to check whether this results in multiple additions in case the controller is used more than once
                    map.on("click", function (mapclick) {
                        console.log("onclick(): " + mapclick.latlng.lat + "/" + mapclick.latlng.lng);

                        console.log("creating inputPopup...");

                        inputPopupContent.textContent = "auswählen?";

                        inputPopupContent.onclick = function () {
                            // this is a workaround, see https://leaflet.uservoice.com/forums/150880-ideas-and-suggestions-for-leaflet/suggestions/3272312-an-api-function-to-close-a-popup-at-the-moment-i
                            inputPopup._close();
                            console.log("inputPopupContent.onclick()")
                            this.onInputLocation(mapclick.latlng);
                        }.bind(this);

                        inputPopup
                            .setLatLng(mapclick.latlng)
                            .setContent(inputPopupContent)
                            .openOn(map);
                    }.bind(this));
                }


                // TODO: and do not forget to call the callback function that is passed to us - if asychronous functions are used for initialisation, calling callback needs to be done in the respective callback functions
                callback();
            }.bind(this));
        }

        this.onInputLocation = function(latlng) {
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
        this.addMarkerForLocationItem = function(locItem,popup,layers) {

        }

        this.bindMarkerPopupToLocationItem = function(popupHtmlText,locItem) {

        }

        this.removeMarkerLayer = function(layer) {

        }

        this.onMarkerPopupSelected = function(locItem) {

        }

    }
    // extend the view controller supertype
    mwf.xtends(MapViewController,mwf.ViewController);

    // and return the view controller function
    return MapViewController;
});
