/**
 * @author Jörn Kreutel
 *
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";

export default class NotesOverviewViewController extends mwf.ViewController {

    constructor() {
        console.log("NotesOverviewViewController()");
        super();
    }


    /*
     * for any view: initialise the view
     */
    async oncreate() {
        console.log("oncreate()");
        // bind the add button
        this.root.querySelector("#newNoteAction").onclick = () => {
            this.nextView("notesEditview",{item: new entities.Note()})
        };

        // register listener for crud events rather than handling changes in returnFromSubview
        this.addListener(new mwf.EventMatcher("crud","created","Note"),(event) => {
            this.addToListview(event.data);
        });
        this.addListener(new mwf.EventMatcher("crud","updated","Note"),(event) => {
            this.updateInListview(event.data._id, event.data);
        });
        this.addListener(new mwf.EventMatcher("crud","deleted","Note"),(event) => {
            this.removeFromListview(event.data);
        });

        // we also listen to the change of the crudops
        this.addListener(new mwf.EventMatcher("crud","changedScope"),(event) => {
            console.log("scope of crudops has changed. Reload entities and refresh listview...");
            entities.Note.readAll((notes) => {
                this.initialiseListview(notes);
            });
        });

        entities.Note.readAll((notes) => {
            this.initialiseListview(notes);
        });

        // call the supertype lifecycle function and pass the callback
        super.oncreate();
    }

    /*
     * callback from the list item menu
     */
    deleteNote(item) {
        item.delete(() => {
                console.log("deleteNote() finished.");
            }
        );
    }

    async onpause() {
        console.log("onpause()");
        super.onpause();
    }

    async onstop() {
        console.log("onstop()");
        super.onstop();
    }

}
