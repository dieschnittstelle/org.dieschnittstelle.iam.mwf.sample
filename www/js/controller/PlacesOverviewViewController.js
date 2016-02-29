/**
 * @author Jörn Kreutel
 */
define(["mwf","entities"], function(mwf, entities) {

    function PlacesOverviewViewController() {
        console.log("PlacesOverviewViewController()");

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = PlacesOverviewViewController.prototype;

        /*
         * for any view: initialise the view
         */
        this.oncreate = function (callback) {
            console.log("oncreate(): args: " + (this.args ? mwf.stringify(this.args) : "no args"));


            this.root.querySelector("#newPlaceAction").onclick = function() {
                this.nextView("placesEditview",{item: new entities.Place()})
            }.bind(this);

            // register listener for crud events rather than handling changes in returnFromSubview
            this.addListener(new mwf.EventMatcher("crud","created","Place"),function(event){
                this.addToListview(event.data);
            }.bind(this));
            this.addListener(new mwf.EventMatcher("crud","updated","Place"),function(event) {
                this.updateInListview(event.data._id, event.data);
            }.bind(this));
            this.addListener(new mwf.EventMatcher("crud","deleted","Place"),function(event) {
                this.removeFromListview(event.data);
            }.bind(this));

            // we also listen to the change of the crudops
            this.addListener(new mwf.EventMatcher("crud","changedScope"),function(event){
                console.log("scope of crudops has changed. Reload entities and refresh listview...");
                entities.Place.readAll(function (places) {
                    this.initialiseListview(places);
                }.bind(this));
            }.bind(this));

            entities.Place.readAll(function(places){
                this.initialiseListview(places);
            }.bind(this));

            // call the superclass once creation is done
            proto.oncreate.call(this,callback);
        }

        this.deletePlace = function(item) {
            item.delete(function(){
                console.log("deletePlace(): done");
            });
        }


    }

    // extend the view controller supertype
    mwf.xtends(PlacesOverviewViewController,mwf.ViewController);

    // and return the view controller function
    return PlacesOverviewViewController;
});
