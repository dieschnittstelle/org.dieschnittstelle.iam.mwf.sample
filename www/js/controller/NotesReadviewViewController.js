/**
 * @author Jörn Kreutel
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";

export default class NotesReadviewViewController extends mwf.ViewController {

    constructor() {
        console.log("NotesReadviewViewController()");
        super();

        // a proxy object for the view template we are using, for update
        this.viewProxy = null;
    }

    /*
     * for any view: initialise the view
     */
    async oncreate() {
        console.log("oncreate(): args: " + (this.args ? mwf.stringify(this.args) : "no args"));
        // do databinding, set listeners, initialise the view
        this.viewProxy = this.bindElement("notesReadviewTemplate",this.args,this.root).viewProxy;

        this.viewProxy.bindAction("editNote",() => {
            this.nextView("notesEditview",this.args)
        });
        this.viewProxy.bindAction("deleteNote",() => {
            this.args.item.delete(() => {
                console.log("deleteNote() finished.");
                // return to the previous view
                this.previousView();
            });
        });

        this.viewProxy.bindAction("selectTag",(event) => {
            event.original.stopPropagation();
            var tagid = event.node.getAttribute("data-mwf-id");
            console.log("selectTag: " + tagid);
            var tag = this.args.item.getTag(tagid);
            this.nextView("taggableOverview",{item: tag});
        });

        // we add an event listener that listens to updates of Note items
        this.addListener(new mwf.EventMatcher("crud","updated","Note"),(event) => {
            // check whether the event that is updated is identical to our one (if for whatever reason this was possible...)
            if (event.data._id != this.args.item._id) {
                console.error("got an update event for Note, but it seems to be a different Note instance from mine: " + this.args.item._id + ", updated instance is: " + event.data._id);
            }
            else {
                this.viewProxy.update(this.args);
            }
        });
        // we add another listener that will be executed also onpause and that marks the current controller as obsolete if an item has been deleted
        // (this is for skipping this view in case we run delete from the editview)
        this.addListener(new mwf.EventMatcher("crud","deleted","Note"),(event) => {
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
        super.oncreate();
    }

}
