/**
 * @author Jörn Kreutel
 *
 * TODO: when adding a tag without saving the object, tag list creation may not work correctly. It might be better to undo all changes once leaving the view without saving!
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";

export default class NotesDetailviewViewController extends mwf.ViewController {

    constructor() {
        super();
        console.log("NotesDetailviewViewController()");

        this.defaultContent = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
        // the view proxy
        this.viewProxy = null;
        // the object that is dealt with by this view
        this.noteItem = null;
    }


    /*
     * for any view: initialise the view
     */
    async oncreate() {
        // as the whole view is a template we need to first create it before calling oncreate on superclass, otherwise generic elements will not be initialised.

        // if we do not have any args, we might be styled
        // TODO: there should be a generic solution for this issue!!!
        if (!this.args) {
            console.warn("no args specified. Assume the view is just being styled...");
            this.viewProxy = this.bindElement("notesEditviewTemplate", {item:{title: "lorem",tags:[{name:"ipsum",_id:0},{name:"ipsum",_id:0},{name:"ipsum",_id:0},{name:"ipsum",_id:0}, {name:"dolor",_id:2}]}}, this.root).viewProxy;
        }
        else {
            console.log("oncreate() args: " + mwf.stringify(this.args) + "/" + this.root);
            this.noteItem = this.args.item;

            // we bind to the root element
            this.viewProxy = this.bindElement("notesEditviewTemplate", {item: this.noteItem}, this.root).viewProxy;

            // attention! if the callback specified in the template does not exist, no error will be thrown!
            this.viewProxy.bindAction("pasteDefaultContent", () => {
                this.noteItem.content = this.defaultContent;
                this.viewProxy.update({item: this.noteItem});
            });
            this.viewProxy.bindAction("deleteNote", () => {
                if (this.noteItem.created) {
                    this.noteItem.delete(() => {
                        console.log("deleteNote() finished.");
                        // return to the previous view
                        this.previousView();
                    });
                }
                // if we are in create mode, we just return
                else {
                    this.previousView();
                }
            });
            this.viewProxy.bindAction("addTag", () => {
                this.showDialog("selectTagDialog",{tagableItem: this.noteItem, receiverId: this.root.id});
            });

            // deal with form submission
            this.viewProxy.bindAction("submitNoteForm", (event) => {

                // attention! Ractive already handles event.preventDefault() and passes an object that is NOT the original event!
                //event.preventDefault();
                function showTags(note) {
                    console.log("showTags()...")
                    note.tags.forEach((item) => {
                        console.log("found tag: {@typename: " + item.getTypename() + ", _id: " + item._id + ", name: " + item.name + "}");
                    });
                }

                if (!this.noteItem.created) {
                    // for debugging, log the tag's content
                    showTags(this.noteItem);
                    // create a new notes item and return to the previous view
                    this.noteItem.create(() => {
                        console.log("submitNote(): object created.");
                        showTags(this.noteItem);
                        this.previousView();
                    });
                }
                else {
                    this.noteItem.markModified();
                    showTags(this.noteItem);
                    this.noteItem.update(() => {
                        console.log("sumitNote(): object updated: " + mwf.stringify(this.noteItem));
                        showTags(this.noteItem);
                        this.previousView();
                    });
                }

                return false;
            });

            // we bind the two actions which might be received by the elements in the taglist
            this.viewProxy.bindAction("selectTag",(event) => {
                event.original.stopPropagation();
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("selectTag: " + tagid);
                var tag = this.noteItem.getTag(tagid);
                this.nextView("taggableOverview",{item: tag});
            });
            this.viewProxy.bindAction("removeTag",(event) => {
                event.original.stopPropagation();
                // obtain the tagid
                var tagid = event.node.getAttribute("data-mwf-id");
                console.log("removeTag with id: " + tagid);
                // lookup the tag
                var tag = this.noteItem.getTag(tagid);
                console.log("removeTag: " + tag);
                this.showDialog("removeTagDialog",{
                    tag: tag,
                    actionBindings: {
                        okAction: () => {
                            this.noteItem.removeTag(tag);
                            this.refreshView();
                            this.hideDialog();
                        },
                        cancelAction: () => {
                            this.hideDialog();
                        }
                    }
                });
            });

            // register for the "added" ui event for tag in order to be able to refresh the view
            this.addListener(new mwf.EventMatcher("ui","added","Tag"),(event) => {
                if (event.data.receiverId == this.root.id) {
                    console.log("a tag was added. Refresh the view: " + mwf.stringify(this.args));
                    this.refreshView(this);
                }
                else {
                    console.log("a tag was added, but " + this.root.id + " is not addressed: " + event.data.receiverId);
                }
            });

        }

        // TODO: call the superclass function and pass the callback
        super.oncreate();
    }

    /*
     * for views with dialogs
     */
    bindDialog(dialogid,dialog,item) {
        // call the supertype function
        super.bindDialog(dialogid,dialog,item);
        // TODO: implement action bindings for dialog, accessing dialog.root
    }

    refreshView() {
        this.viewProxy.update(this.args);
    }


}
