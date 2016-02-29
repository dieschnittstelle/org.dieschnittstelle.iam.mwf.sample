/**
 * @author Jörn Kreutel
 *
 */
define(["mwf","entities"], function(mwf, entities) {

    function NotesOverviewViewController() {
        console.log("NotesOverviewViewController()");

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = NotesOverviewViewController.prototype;

        /*
         * for any view: initialise the view
         */
        this.oncreate = function (callback) {
            console.log("oncreate()");
            // bind the add button
            this.root.querySelector("#newNoteAction").onclick = function() {
                this.nextView("notesEditview",{item: new entities.Note()})
            }.bind(this);

            // register listener for crud events rather than handling changes in returnFromSubview
            this.addListener(new mwf.EventMatcher("crud","created","Note"),function(event){
                this.addToListview(event.data);
            }.bind(this));
            this.addListener(new mwf.EventMatcher("crud","updated","Note"),function(event) {
                this.updateInListview(event.data._id, event.data);
            }.bind(this));
            this.addListener(new mwf.EventMatcher("crud","deleted","Note"),function(event) {
                this.removeFromListview(event.data);
            }.bind(this));

            // we also listen to the change of the crudops
            this.addListener(new mwf.EventMatcher("crud","changedScope"),function(event){
                console.log("scope of crudops has changed. Reload entities and refresh listview...");
                entities.Note.readAll(function (notes) {
                    this.initialiseListview(notes);
                }.bind(this));
            }.bind(this));

            entities.Note.readAll(function(notes){
                this.initialiseListview(notes);
            }.bind(this));

            // call the supertype lifecycle function and pass the callback
            proto.oncreate.call(this,callback);
        }

        /*
         * callback from the list item menu
         */
        this.deleteNote = function(item) {
            item.delete(function(){
                    console.log("deleteNote() finished.");
                }
            );
        }

        this.onpause = function(callback) {
            console.log("onpause()");
            proto.onpause.call(this,callback);
        }

        this.onstop = function(callback) {
            console.log("onstop()");
            proto.onstop.call(this,callback);
        }

    }

    // extend the view controller supertype
    mwf.xtends(NotesOverviewViewController,mwf.ViewController);

    // and return the view controller function
    return NotesOverviewViewController;
});
