/**
 * @author Jörn Kreutel
 */
define(["mwf","entities"], function(mwf, entities) {

    function NotesReadviewViewController() {
        console.log("NotesReadviewViewController()");

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = NotesReadviewViewController.prototype;

        // a proxy object for the view template we are using, for update
        var viewProxy;

        /*
         * for any view: initialise the view
         */
        this.oncreate = function (callback) {
            console.log("oncreate(): args: " + (this.args ? mwf.stringify(this.args) : "no args"));
            // do databinding, set listeners, initialise the view
            viewProxy = this.bindElement("notesReadviewTemplate",this.args,this.root).viewProxy;

            viewProxy.bindAction("editNote",function() {
                this.nextView("notesEditview",this.args)
            }.bind(this));
            viewProxy.bindAction("deleteNote",function() {
                this.args.item.delete(function(){
                    console.log("deleteNote() finished.");
                    // return to the previous view
                    this.previousView();
                }.bind(this))
            }.bind(this));

            viewProxy.bindAction("selectTag",function(event){
                event.original.stopPropagation();
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("selectTag: " + tagid);
                var tag = this.args.item.getTag(tagid);
                this.nextView("taggableOverview",{item: tag});
            }.bind(this));

            // we add an event listener that listens to updates of Note items
            this.addListener(new mwf.EventMatcher("crud","updated","Note"),function(event){
                // check whether the event that is updated is identical to our one (if for whatever reason this was possible...)
                if (event.data._id != this.args.item._id) {
                    console.error("got an update event for Note, but it seems to be a different Note instance from mine: " + this.args.item._id + ", updated instance is: " + event.data._id);
                }
                else {
                    viewProxy.update(this.args);
                }
            });
            // we add another listener that will be executed also onpause and that marks the current controller as obsolete if an item has been deleted
            // (this is for skipping this view in case we run delete from the editview)
            this.addListener(new mwf.EventMatcher("crud","deleted","Note"),function(event){
                // check whether the event that is updated is identical to our one (if for whatever reason this was possible...)
                if (event.data != this.args.item._id) {
                    console.error("got a delete event for Note, but it seems to be a different Note instance from mine: " + this.args.item._id + ", deleted instance is: " + event.data._id);
                }
                else {
                    this.markAsObsolete();
                }
                /* this is the runOnPause parameter */
            },true);

            // call the superclass once creation is done
            proto.oncreate.call(this,callback);
        }

    }

    // extend the view controller supertype
    mwf.xtends(NotesReadviewViewController,mwf.ViewController);

    // and return the view controller function
    return NotesReadviewViewController;
});
