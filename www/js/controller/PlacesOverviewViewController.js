/**
 * @author Jörn Kreutel
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";

export default class PlacesOverviewViewController extends mwf.ViewController {

    constructor() {
        console.log("PlacesOverviewViewController()");
        super();
    }

    /*
     * for any view: initialise the view
     */
    async oncreate() {
        console.log("oncreate(): args: " + (this.args ? mwf.stringify(this.args) : "no args"));


        this.root.querySelector("#newPlaceAction").onclick = () => {
            this.nextView("placesEditview",{item: new entities.Place(), mode: "edit"});
        };

        // register listener for crud events rather than handling changes in returnFromSubview
        this.addListener(new mwf.EventMatcher("crud","created","Place"),(event) => {
            this.addToListview(event.data);
        });
        this.addListener(new mwf.EventMatcher("crud","updated","Place"),(event) => {
            this.updateInListview(event.data._id, event.data);
        });
        this.addListener(new mwf.EventMatcher("crud","deleted","Place"),(event) => {
            this.removeFromListview(event.data);
        });

        // we also listen to the change of the crudops
        this.addListener(new mwf.EventMatcher("crud","changedScope"),(event) => {
            console.log("scope of crudops has changed. Reload entities and refresh listview...");
            entities.Place.readAll((places) => {
                this.initialiseListview(places);
            });
        });

        entities.Place.readAll((places) => {
            this.initialiseListview(places);
        });

        // call the superclass once creation is done
        super.oncreate();
    }

    deletePlace(item) {
        item.delete(() => {
            console.log("deletePlace(): done");
        });
    }

    editPlace(item) {
        this.nextView("placesEditview", {item: item, mode: "edit"});
    }

}
