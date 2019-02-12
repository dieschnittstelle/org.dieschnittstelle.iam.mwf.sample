/**
 * @author Jörn Kreutel
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";

// TODO: this controller is not yet sensitive with regard to deletion of tagged items
export default class TaggableOverviewViewController extends mwf.ViewController {

    constructor() {
        console.log("TaggableOverviewViewController()");
        super();

        this.viewProxy = null;
    }

    /*
     * for any view: initialise the view
     */
    async oncreate() {
        // we first render the empty view and then load the content
        this.viewProxy = this.bindElement("taggableTemplate", this.args, this.root).viewProxy;

        // add an action binding
        this.viewProxy.bindAction("showContentItem",(event) => {
            // this is required in order to avoid that the listview tries to read out the item (which will result in an error)
            event.original.stopPropagation();

            var itemid = event.node.getAttribute("data-mwf-id");
            var segmented = mwf.segmentTypedId(itemid);

            switch(segmented.typename) {
                case "Note":
                    entities.Note.read(segmented.id,(item) => {
                        this.nextView("notesReadview",{item: item});
                    });
                    break;
                case "Place":
                    entities.Place.read(segmented.id,(item) => {
                        this.nextView("placesEditview",{item: item});
                    });
                    break;
                default:
                    mwfUtils.showToast("cannot handle item type: " + segmented.typename);
            }
        });

        // load the tagged entities given the tag
        this.args.item.contentItems.load(() => {
            var loaded = this.args.item.contentItems;
            console.log("loaded " +  loaded.length + " elements: " + mwf.stringify(loaded));
            // we read out the types of the items and group them by type
            this.viewProxy.update({item: this.args.item,groups:/*[{name: "TestType", contentItems: loaded}]*/this.groupItems(loaded)});
        });

        // call the superclass once creation is done
        super.oncreate();
    }

    groupItems(items) {

        var groups = new Object();
        items.forEach((item) => {
            if (item) {
                var typename = item.getTypename();
                var typeitems = groups[typename];
                if (!typeitems) {
                    typeitems = new Array();
                    groups[typename] = typeitems;
                }
                typeitems.push(item);
            }
        });

        // convert to an array which will be used by the view
        var groupsarr = new Array();
        for (var group in groups) {
            groupsarr.push({type: group, contentItems: groups[group]});
        }

        return groupsarr;
    }


}