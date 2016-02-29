/**
 * @author Jörn Kreutel
 *
 * TODO: when adding a tag without saving the object, tag list creation may not work correctly. It might be better to undo all changes once leaving the view without saving!
 */
define(["mwf","mwfUtils","entities"], function(mwf, mwfUtils,entities) {

    function NotesDetailviewViewControllere() {
        console.log("NotesDetailviewViewControllere()");

        var defaultContent = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = NotesDetailviewViewControllere.prototype;

        // the view proxy
        var viewProxy;

        // the object that is dealt with by this view
        var noteItem;

        /*
         * for any view: initialise the view
         */
        this.oncreate = function (callback) {
            // as the whole view is a template we need to first create it before calling oncreate on superclass, otherwise generic elements will not be initialised.

            // if we do not have any args, we might be styled
            // TODO: there should be a generic solution for this issue!!!
            if (!this.args) {
                console.warn("no args specified. Assume the view is just being styled...");
                viewProxy = this.bindElement("notesEditviewTemplate", {item:{title: "lorem",tags:[{name:"ipsum",_id:0},{name:"ipsum",_id:0},{name:"ipsum",_id:0},{name:"ipsum",_id:0}, {name:"dolor",_id:2}]}}, this.root).viewProxy;
            }
            else {
                console.log("oncreate() args: " + mwf.stringify(this.args) + "/" + this.root);
                noteItem = this.args.item;

                // we bind to the root element
                viewProxy = this.bindElement("notesEditviewTemplate", {item: noteItem}, this.root).viewProxy;

                // attention! if the callback specified in the template does not exist, no error will be thrown!
                viewProxy.bindAction("pasteDefaultContent", function () {
                    noteItem.content = defaultContent;
                    viewProxy.update({item: noteItem});
                }.bind(this));
                viewProxy.bindAction("deleteNote", function () {
                    if (noteItem.created) {
                        noteItem.delete(function () {
                            console.log("deleteNote() finished.");
                            // return to the previous view
                            this.previousView();
                        }.bind(this))
                    }
                    // if we are in create mode, we just return
                    else {
                        this.previousView();
                    }
                }.bind(this));
                viewProxy.bindAction("addTag", function () {
                    this.showDialog("selectTagDialog",{tagableItem: noteItem, receiverId: this.root.id});
                }.bind(this));

                // deal with form submission
                viewProxy.bindAction("submitNoteForm", function (event) {

                    // attention! Ractive already handles event.preventDefault() and passes an object that is NOT the original event!
                    //event.preventDefault();
                    function showTags(note) {
                        console.log("showTags()...")
                        note.tags.forEach(function(item){
                            console.log("found tag: {@typename: " + item.getTypename() + ", _id: " + item._id + ", name: " + item.name + "}");
                        });
                    }

                    if (!noteItem.created) {
                        // for debugging, log the tag's content
                        showTags(noteItem);
                        // create a new notes item and return to the previous view
                        noteItem.create(function () {
                            console.log("submitNote(): object created.");
                            showTags(noteItem);
                            this.previousView();
                        }.bind(this));
                    }
                    else {
                        noteItem.markModified();
                        showTags(noteItem);
                        noteItem.update(function () {
                            console.log("sumitNote(): object updated: " + mwf.stringify(noteItem));
                            showTags(noteItem);
                            this.previousView();
                        }.bind(this));
                    }

                    return false;
                }.bind(this));

                // we bind the two actions which might be received by the elements in the taglist
                viewProxy.bindAction("selectTag",function(event){
                    event.original.stopPropagation();
                    var tagid = event.node.getAttribute("data-mwf-id");
                    console.log("selectTag: " + tagid);
                    var tag = noteItem.getTag(tagid);
                    this.nextView("taggableOverview",{item: tag});
                }.bind(this));
                viewProxy.bindAction("removeTag",function(event){
                    event.original.stopPropagation();
                    // obtain the tagid
                    var tagid = event.node.getAttribute("data-mwf-id");
                    console.log("removeTag with id: " + tagid);
                    // lookup the tag
                    var tag = noteItem.getTag(tagid);
                    console.log("removeTag: " + tag);
                    this.showDialog("removeTagDialog",{
                        tag: tag,
                        actionBindings: {
                            okAction: function() {
                                noteItem.removeTag(tag);
                                refreshView.call(this);
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
                        refreshView.call(this);
                    }
                    else {
                        console.log("a tag was added, but " + this.root.id + " is not addressed: " + event.data.receiverId);
                    }
                }.bind(this));

            }

            // TODO: call the superclass function and pass the callback
            proto.oncreate.call(this,callback);
        }

        /*
         * for views with dialogs
         */
        this.bindDialog = function(dialogid,dialog,item) {
            // call the supertype function
            proto.bindDialog.call(this,dialogid,dialog,item);
            // TODO: implement action bindings for dialog, accessing dialog.root
        }

        function refreshView() {
            viewProxy.update(this.args);
        }


    }

    // extend the view controller supertype
    mwf.xtends(NotesDetailviewViewControllere,mwf.ViewController);

    // and return the view controller function
    return NotesDetailviewViewControllere;
});
