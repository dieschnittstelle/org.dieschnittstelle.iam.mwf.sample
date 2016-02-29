/**
 * @author Jörn Kreutel
 */

// we use the model from which we take the location type
// TODO: organise this differently
define(function() {

    // this needs to be global
    var mapObject;

    /*
     * this is a singleton that holds a map instance that will be reused over all map users
     */
    function MapHolder() {

        console.log("MapHolder.constructor()")

        var mapWrapper = document.getElementById("mwf-mapwrapper");
        var mapElement = document.getElementById("map");

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

        this.createMap = function(initialiseView,params) {
            console.log("createMap(): mapObject is: " + mapObject);

            if (!mapObject) {
                console.log("create map object...");
                mapObject = L.map("map");
            }

            if (initialiseView) {
                console.log("initialiseLayer...");
                // we set a default view and layers here
                var latlong = ((params && params.latlong) ? params.latlong : [52.544966, 13.355167]);
                var zoom = ((params && params.zoom) ? params.zoom : 13);

                console.log("initialiseView: latlong: " + latlong);
                console.log("initialiseView: zoom: " + zoom);

                mapObject.setView(latlong, zoom);

                L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                    attribution: '&amp;copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(mapObject);

                var marker = L.marker(latlong).addTo(mapObject);
            }
            console.log("createMap(): done. Returning mapObject: " + mapObject);

            return mapObject;
        }

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

    }

    // we return the map holder singleton
    return new MapHolder();
});
