/**
 * @author Jörn Kreutel
 *
 * TODO: supertype of view controllers for taggable elements, adding controls for tag assignmn
 */
define(["mwf","mwfUtils","entities"], function(mwf, mwfUtils,entities) {

    function TaggableEditviewViewController() {
        console.log("TaggableEditviewViewController()");

        var defaultContent = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = TaggableEditviewViewController.prototype;

        // the view proxy, which needs to be a public attribute for being used in subclasses
        this.viewProxy;

        /*
         * for any view: initialise the view
         */
        this.oncreate = function (callback) {
            // handle the controls for tag addition/removal
            this.viewProxy.bindAction("addTag", function () {
                this.showDialog("selectTagDialog",{tagableItem: this.args.item, receiverId: this.root.id});
            }.bind(this));

            // we bind the two actions which might be received by the elements in the taglist
            this.viewProxy.bindAction("selectTag",function(event){
                event.original.stopPropagation();
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("selectTag: " + tagid);
                var tag = this.args.item.getTag(tagid);
                this.nextView("taggableOverview",{item: tag});
            }.bind(this));
            this.viewProxy.bindAction("removeTag",function(event){
                event.original.stopPropagation();
                // obtain the tagid
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("removeTag with id: " + tagid);
                // lookup the tag
                var tag = this.args.item.getTag(tagid);
                console.log("removeTag: " + tag);
                this.showDialog("removeTagDialog",{
                    tag: tag,
                    actionBindings: {
                        okAction: function() {
                            this.args.item.removeTag(tag);
                            this.refreshView();
                            this.hideDialog();
                        }.bind(this),
                        cancelAction: function() {
                            this.hideDialog();
                        }.bind(this)
                    }
                });
            }.bind(this));

            // register for the "added" ui event for tag in order to be able to refresh the view
            this.addListener(new mwf.EventMatcher("ui","added","Tag"),function(event){
                if (event.data.receiverId == this.root.id) {
                    console.log("a tag was added. Refresh the view: " + mwf.stringify(this.args));
                    this.refreshView();
                }
                else {
                    console.log("a tag was added, but " + this.root.id + " is not addressed: " + event.data.receiverId);
                }
            }.bind(this));

            // TODO: call the superclass function and pass the callback
            proto.oncreate.call(this,callback);
        }

        this.refreshView = function() {
            this.viewProxy.update(this.args);
        }


    }

    // extend the view controller supertype
    mwf.xtends(TaggableEditviewViewController,mwf.ViewController);

    // and return the view controller function
    return TaggableEditviewViewController;
});
