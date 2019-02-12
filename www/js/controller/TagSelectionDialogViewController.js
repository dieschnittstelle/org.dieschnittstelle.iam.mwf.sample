/**
 * @author Jörn Kreutel
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";
import {mwfUtils} from "../Main.js";

export default class TagSelectionDialogViewController extends mwf.EmbeddedViewController {

    constructor() {
        console.log("TagSelectionDialogViewController()");
        super();

        // the dom element that holds the taglist
        this.tagnamesDatalist = [];

        // the form for tagname input
        this.tagnameInputForm = null;

        // two maps that hold all tags and tagOption elements, for allowing easy access to option items on update etc.
        // we use id->tag and name->tag
        // TODO: need to ensure that duplicates are forbidden!
        this.id2tag = {};
        this.name2tag = {};

        // the item that shall be tagged
        this.taggableItem = null;
    }

    /*
     * for any view: initialise the view
     *
     * here, we use conventional dom handling, rather than employing templates
     */
    async oncreate() {
        console.log("oncreate(): TagSelectionDialogViewController");

        // bind the dom elements to the instance attributes
        this.tagnameInputForm = document.forms["tagnameInputForm"];
        this.tagnamesDatalist = document.getElementById("tagnamesDatalist");

        // register event listeners for crud events
        this.addListener(new mwf.EventMatcher("crud","created","Tag"),function(event){
            this.addOptionForTag.call(this,event.data);
        }.bind(this),true);
        this.addListener(new mwf.EventMatcher("crud","deleted","Tag"),function(event){
            this.deleteOptionForTag.call(this,event.data);
        }.bind(this),true);
        this.addListener(new mwf.EventMatcher("crud","updated","Tag"),function(event){
            this.updateOptionForTag.call(this,event.data);
        }.bind(this),true);

        // handle submission of the form
        this.tagnameInputForm.addEventListener("submit",function(event){
            event.preventDefault();
            // read out the selected tagname
            var selectedTagname = this.tagnameInputForm.tagnameInput.value;
            console.log("selectedTagname: " + selectedTagname);
            // check whether the name exists
            if (this.name2tag[selectedTagname]) {
                mwfUtils.showToast("selected existing tag: " + selectedTagname);
                // we communicate tag selection via the event dispatcher - in a way this is only required for letting the receivers update their view as the object reference of taggableItem will be preserved!
                this.taggableItem.addTag(this.name2tag[selectedTagname].tag);
                this.notifyListeners(new mwf.Event("ui","added","Tag",this.args));
                this.hideDialog();
            }
            // reconfirm creation using a dialog that employs the generic dialog view controller
            // for this reason, we specify the action bindings for the dialog
            else {
                var newTag = new entities.Tag(selectedTagname);
                // we use a generic dialog controller which receives action bindings as arguments
                this.showDialog("confirmNewTagDialog", {
                    tag: newTag,
                    actionBindings:{
                        cancelNewTag: function(){
                            this.hideDialog();
                        }.bind(this),
                        createNewTag: function(){
                            newTag.create(function() {
                                console.log("createNewTag(): finished.");
                                // add the tag to the taggableItem
                                this.taggableItem.addTag(newTag);
                                // notify the listeners
                                this.notifyListeners(new mwf.Event("ui","added","Tag",this.args));
                                this.hideDialog();
                            }.bind(this));
                        }.bind(this)
                    }
                });
            }
        }.bind(this));

        // read out all tags and populate the datalist
        entities.Tag.readAll(function(tags){
            console.log("found tags: " + tags.length);
            // for each tag, we create an option element and add it to the list
            for (var i=0;i<tags.length;i++) {
                var currentTag = tags[i];
                this.addOptionForTag.call(this,currentTag);
            }
        }.bind(this));


        // call the superclass once creation is done
        super.oncreate();
    }

    /* onresume, we reset the form */
    async onresume() {

        this.taggableItem = this.args.tagableItem;
        console.log("onresume(): taggableItem: " + this.taggableItem + " with id: " + this.taggableItem._id + ", receiverId is: " + this.args.receiverId);

        this.tagnameInputForm.reset();
        super.onresume();
    }

    /*
     * for views with dialogs
     */
    bindDialog(dialogid,dialog,item) {
        // call the supertype function
        super.bindDialog(dialogid,dialog,item);
    }

    addOptionForTag(tag) {
        console.log("addOptionForTag: " + tag.name);
        // create a new instance of the template
        var tagnameOption = this.getTemplateInstance("tagnameOption").root;
        // add attribute and text content
        tagnameOption.value = tag.name;
        // append it to the datalist
        this.tagnamesDatalist.appendChild(tagnameOption);

        // then store the tags locally
        var localTagBinding = {tag: tag,option: tagnameOption};
        this.id2tag[tag._id] = localTagBinding;
        this.name2tag[tag.name] = localTagBinding;

        console.log("added option element for tag " + tag.name);
    }

    deleteOptionForTag(tagid) {
        console.log("removeOptionForTag(): " + tagid);
        var tagBinding = this.id2tag[tagid];
        // remove the element from the parent
        tagBinding.option.parentNode.removeChild(tagBinding.option);
        // remove the option from the lists
        delete this.id2tag[tagid];
        delete this.name2tag[tagBinding.tag.name];
    }

    updateOptionForTag(updatedtag) {
        console.log("updateOptionForTag(): " + updatedtag._id + "/" + updatedtag.name);
        // retrieve the old name
        var tagBinding = this.id2tag[updatedtag._id];
        // remove the entry from the name2tag mapping
        delete this.name2tag[tagBinding.tag.name];
        // update the binding and the name2tag mapping
        tagBinding.tag = updatedtag;
        this.name2tag[tagBinding.tag.name] = tagBinding;
        // update the option
        tagBinding.option.value = tagBinding.tag.name;
    }


}
