/**
 * @author Jörn Kreutel
 */
define(["mwf","mwfUtils","entities"], function(mwf, mwfUtils,entities) {

    function TaggableOverviewViewController() {
        console.log("TaggableOverviewViewController()");

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = TaggableOverviewViewController.prototype;

        var viewProxy;

        /*
         * for any view: initialise the view
         */
        this.oncreate = function (callback) {
            // we first render the empty view and then load the content
            viewProxy = this.bindElement("taggableTemplate", this.args, this.root).viewProxy;

            // add an action binding
            viewProxy.bindAction("showContentItem",function(event){
                // this is required in order to avoid that the listview tries to read out the item (which will result in an error)
                event.original.stopPropagation();

                var itemid = event.node.getAttribute("data-mwf-id");
                var segmented = mwf.segmentTypedId(itemid);

                switch(segmented.typename) {
                    case "Note":
                        entities.Note.read(segmented.id,function(item){
                           this.nextView("notesReadview",{item: item});
                        }.bind(this));
                        break;
                    case "Place":
                        entities.Place.read(segmented.id,function(item){
                            this.nextView("placesEditview",{item: item});
                        }.bind(this));
                        break;
                    default:
                        mwfUtils.showToast("cannot handle item type: " + segmented.typename);
                }
            }.bind(this));

            // load the tagged entities given the tag
            this.args.item.contentItems.load(function(){
                var loaded = this.args.item.contentItems;
                console.log("loaded " +  loaded.length + " elements: " + mwf.stringify(loaded));
                // we read out the types of the items and group them by type
                viewProxy.update({item: this.args.item,groups:/*[{name: "TestType", contentItems: loaded}]*/groupItems(loaded)});
            }.bind(this));

            // call the superclass once creation is done
            proto.oncreate.call(this,callback);
        }

        function groupItems(items) {

            var groups = new Object();
            items.forEach(function(item){
               var typename = item.getTypename();
               var typeitems = groups[typename];
                if (!typeitems) {
                    typeitems = new Array();
                    groups[typename] = typeitems;
                }
                typeitems.push(item);
            });

            // convert to an array which will be used by the view
            var groupsarr = new Array();
            for (var group in groups) {
                groupsarr.push({type: group, contentItems: groups[group]});
            }

            return groupsarr;
        }


    }

    // extend the view controller supertype
    mwf.xtends(TaggableOverviewViewController,mwf.ViewController);

    // and return the view controller function
    return TaggableOverviewViewController;
});
