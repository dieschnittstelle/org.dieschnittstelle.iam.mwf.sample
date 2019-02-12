/**
 * @author Jörn Kreutel
 */

// we use the model from which we take the location type
// TODO: organise this differently, there is still some optimisation potential, e.g. we could simply return ourselves
// on createMap rather than the map and provide map access setting the map object as property

// this needs to be global
var mapObject;

// some default location
var defaultLocation = [52.544966, 13.355167];

/*
 * this is a singleton that holds a map instance that will be reused over all map users
 */
function MapHolder() {

    console.log("MapHolder.constructor()")

    var mapWrapper = document.getElementById("mwf-mapwrapper");
    var mapElement = document.getElementById("map");

    var markerGroup = null;

    // we keep places and markers in pr
    var markersMap = new Map();

    if (mapWrapper && mapElement) {
        console.log("MapHolder.constructor(): found a map wrapper and map: " + mapWrapper + "/" + map);
    }
    else if (!mapWrapper && mapElement) {
        console.info("MapHolder.constructor(): no map wrapper element found. Application seem to use maps without holder.");
    }
    else if (!mapWrapper) {
        console.info("MapHolder.constructor(): no map wrapper element found. Application does not seem to use maps.");
    }

    this.attach = function(root) {
        console.log("attach()");
        if (!mapWrapper) {
            console.error("something is wrong. Application seems to use map holder, but no map wrapper element exists");
        }
        // if the holder is detached correctly, we do not need to do any checks here or clear the root
        root.appendChild(mapWrapper);
    }

    this.createMap = function(params) {
        console.log("createMap(): mapObject is now: " + mapObject);
        console.log("createMap(): params are: ", params);

        if (!mapObject) {
            console.log("create map object...");
            mapObject = L.map("map");
            markerGroup = L.layerGroup().addTo(mapObject);

            L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                attribution: '&amp;copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapObject);
        }

        this.center(params);

        return mapObject;
    }

    this.addMarker = function(location,popup) {


        var marker = markersMap.get(location);
        if (marker) {
            console.log("marker already exists for location: " + location.name);
        }
        else {
            marker = L.marker(getLatLng(location)).addTo(markerGroup);
            console.log("created new marker for location: " + location.name);
            markersMap.set(location,marker);
        }

        if (popup) {
            // add a popup to the marker (regardless of whether it had existed before or not)
            marker.bindPopup(popup);
        }

    }

    this.removeMarker = function(location) {

        console.log("markersMap: " + markersMap);

        markerGroup.removeLayer(markersMap.get(location)._leaflet_id);
        markersMap.delete(location);
    }

    // set a center
    this.center = function(params) {
        var latlong = ((params && params.location) ? params.location.getLatlng() : defaultLocation);
        var zoom = ((params && params.zoom) ? params.zoom : 13);

        console.log("createMap: latlong: " + latlong);
        console.log("createMap: zoom: " + zoom);

        mapObject.setView(latlong, zoom);
    }

    // arrange the map considering all markers
    this.arrange = function() {
        //console.log("arrange(): markersMap: ", markersMap);
        var markersCoords = [];

        // we create a latlng array from all the markers
        for (var location of markersMap.keys()) {
            console.log("arrange(): considering marker for location: " + location.name);
            markersCoords.push(getLatLng(location));
        }

        console.log("arrange(): markersCoords are: " + markersCoords);

        mapObject.fitBounds(markersCoords);
    }

    // explicit detaching does not seem to be necessary
    this.detach = function() {
        //console.log("detach()");
        //
        ////mapObject.remove();
        //
        //// detaching causes problems...
        //if (false/*mapWrapper.parentNode*/) {
        //    //mapWrapper.parentNode.removeChild(mapWrapper);
        //}
        //else {
        //    console.log("detach(): no need to detach. Map does not seem to be attached currently...");
        //}
    }

    // helper function get latlng from an object which might provide a particular method or not
    function getLatLng(location) {
        if (location.getLatlng) {
            return location.getLatlng();
        }
        else if (!location.lat || !location.lng) {
            console.error("getLatlng(): called for location without lat or lng attribute. Will use default location! location is: ",location);
            return defaultLocation;
        }
        else {
            return [location.lat, location.lng];
        }
    }

}


// we return the map holder singleton
const holder = new MapHolder();
export {holder as default}
