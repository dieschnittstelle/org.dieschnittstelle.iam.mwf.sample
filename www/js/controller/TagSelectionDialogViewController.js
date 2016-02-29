/**
 * @author Jörn Kreutel
 */
define(["mwf","mwfUtils","entities"], function(mwf, mwfUtils,entities) {

    function TagSelectionDialogViewController() {
        console.log("TagSelectionDialogViewController()");

        // declare a variable for accessing the prototype object (used für super() calls)
        var proto = TagSelectionDialogViewController.prototype;

        // the dom element that holds the taglist
        var tagnamesDatalist;

        // the form for tagname input
        var tagnameInputForm;

        // two maps that hold all tags and tagOption elements, for allowing easy access to option items on update etc.
        // we use id->tag and name->tag
        // TODO: need to verify that duplicates are forbidden!
        var id2tag = new Object();
        var name2tag = new Object();

        // the item that shall be tagged
        var tagableItem;

        /*
         * for any view: initialise the view
         *
         * here, we use conventional dom handling, rather than employing templates
         */
        this.oncreate = function (callback) {
            console.log("oncreate(): TagSelectionDialogViewController");

            // bind the dom elements to the instance attributes
            tagnameInputForm = document.forms["tagnameInputForm"];
            tagnamesDatalist = document.getElementById("tagnamesDatalist");

            // register event listeners for crud events
            this.addListener(new mwf.EventMatcher("crud","created","Tag"),function(event){
                addOptionForTag.call(this,event.data);
            }.bind(this),true);
            this.addListener(new mwf.EventMatcher("crud","deleted","Tag"),function(event){
                deleteOptionForTag.call(this,event.data);
            }.bind(this),true);
            this.addListener(new mwf.EventMatcher("crud","updated","Tag"),function(event){
                updateOptionForTag.call(this,event.data);
            }.bind(this),true);

            // handle submission of the form
            tagnameInputForm.addEventListener("submit",function(event){
                event.preventDefault();
                // read out the selected tagname
                var selectedTagname = tagnameInputForm.tagnameInput.value;
                console.log("selectedTagname: " + selectedTagname);
                // check whether the name exists
                if (name2tag[selectedTagname]) {
                    mwfUtils.showToast("selected existing tag: " + selectedTagname);
                    // we communicate tag selection via the event dispatcher - in a way this is only required for letting the receivers update their view as the object reference of tagableItem will be preserved!
                    tagableItem.addTag(name2tag[selectedTagname].tag);
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
                                    // add the tag to the tagableItem
                                    tagableItem.addTag(newTag);
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
                    addOptionForTag.call(this,currentTag);
                }
            }.bind(this));


            // call the superclass once creation is done
            proto.oncreate.call(this,callback);
        }

        /* onresume, we reset the form */
        this.onresume = function(callback) {

            tagableItem = this.args.tagableItem;
            console.log("onresume(): tagableItem: " + tagableItem + " with id: " + tagableItem._id + ", receiverId is: " + this.args.receiverId);

            tagnameInputForm.reset();
            proto.onresume.call(this,callback);
        }

        /*
         * for views with dialogs
         */
        this.bindDialog = function(dialogid,dialog,item) {
            // call the supertype function
            proto.bindDialog.call(this,dialogid,dialog,item);
        }

        function addOptionForTag(tag) {
            console.log("addOptionForTag: " + tag.name);
            // create a new instance of the template
            var tagnameOption = this.getTemplateInstance("tagnameOption").root;
            // add attribute and text content
            tagnameOption.value = tag.name;
            // append it to the datalist
            tagnamesDatalist.appendChild(tagnameOption);

            // then store the tags locally
            var localTagBinding = {tag: tag,option: tagnameOption};
            id2tag[tag._id] = localTagBinding;
            name2tag[tag.name] = localTagBinding;

            console.log("added option element for tag " + tag.name);
        }

        function deleteOptionForTag(tagid) {
            console.log("removeOptionForTag(): " + tagid);
            var tagBinding = id2tag[tagid];
            // remove the element from the parent
            tagBinding.option.parentNode.removeChild(tagBinding.option);
            // remove the option from the lists
            delete id2tag[tagid];
            delete name2tag[tagBinding.tag.name];
        }

        function updateOptionForTag(updatedtag) {
            console.log("updateOptionForTag(): " + updatedtag._id + "/" + updatedtag.name);
            // retrieve the old name
            var tagBinding = id2tag[updatedtag._id];
            // remove the entry from the name2tag mapping
            delete name2tag[tagBinding.tag.name];
            // update the binding and the name2tag mapping
            tagBinding.tag = updatedtag;
            name2tag[tagBinding.tag.name] = tagBinding;
            // update the option
            tagBinding.option.value = tagBinding.tag.name;
        }


    }

    // extend the view controller supertype
    mwf.xtends(TagSelectionDialogViewController,mwf.EmbeddedViewController);

    // and return the view controller function
    return TagSelectionDialogViewController;
});
