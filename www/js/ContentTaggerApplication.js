/**
 * Created by master on 17.02.16.
 */
define(["mwf","mwfUtils","EntityManager","entities","entitiesTest","GenericCRUDImplLocal","GenericCRUDImplRemote"],function(mwf,mwfUtils,EntityManager,entities,entitiesTest,GenericCRUDImplLocal,GenericCRUDImplRemote){

    function ContentTaggerApplication() {

        var proto = ContentTaggerApplication.prototype;

        // the button for toggling the crudscope
        var toggleCrudscopeButtons;

        var initialCRUDScope = this.CRUDOPS.LOCAL;

        this.oncreate = function(callback) {
            console.log("ContentTaggerApplication.oncreate(): calling supertype oncreate")

            // first call the supertype method and pass a callback
            proto.oncreate.call(this,function(){
                console.log("ContentTaggerApplication.oncreate(): back from supertype oncreate");

                toggleCrudscopeButtons = document.getElementsByClassName("cta-toggle-crudscope");
                console.log("ContentTaggerApplication.oncreate(): found " + toggleCrudscopeButtons.length + "  toogle-crudscope buttons");

                // here, we instantiate the data access components
                GenericCRUDImplLocal.initialiseDB("mwfdb", 1, ["Tag", "Note", "Place"], function () {

                    this.registerEntity("Tag", entities.Tag, true);
                    this.registerCRUD("Tag", this.CRUDOPS.LOCAL, GenericCRUDImplLocal.newInstance("Tag"));
                    this.registerCRUD("Tag", this.CRUDOPS.REMOTE, GenericCRUDImplRemote.newInstance("Tag"));

                    this.registerEntity("Note", entities.Note, true);
                    this.registerCRUD("Note", this.CRUDOPS.LOCAL, GenericCRUDImplLocal.newInstance("Note"));
                    this.registerCRUD("Note", this.CRUDOPS.REMOTE, GenericCRUDImplRemote.newInstance("Note"));

                    this.registerEntity("Place", entities.Place, true);
                    this.registerCRUD("Place", this.CRUDOPS.LOCAL, GenericCRUDImplLocal.newInstance("Place"));
                    this.registerCRUD("Place", this.CRUDOPS.REMOTE, GenericCRUDImplRemote.newInstance("Place"));

                    // THIS WILL RESULT IN SETTING THE CRUD DECLARATIONS ON THE entity manager
                    this.initialiseCRUD(initialCRUDScope,EntityManager);


                    // THIS MUST NOT BE FORGOTTEN: initialise the entity manager!
                    EntityManager.initialise();

                    //entitiesTest.test();

                    console.log("ContentTaggerApplication.oncreate(): done.");
                    callback();
                }.bind(this));

            }.bind(this));

        }

        this.initialiseCRUD = function(scope,em) {
            proto.initialiseCRUD.call(this,scope,em);
            for (var i=0;i<toggleCrudscopeButtons.length;i++) {
                if (this.currentCRUDScope == this.CRUDOPS.REMOTE) {
                    toggleCrudscopeButtons[i].classList.add("cta-crudscope-remote");
                }

                toggleCrudscopeButtons[i].onclick = function(event) {
                    console.log("toggleCrudscope(): current scope is: " + this.currentCRUDScope);
                    // toggle the class assignment on the button
                    event.target.classList.toggle("cta-crudscope-remote");
                    // toggle the value of the crudopsScope and
                    if (this.currentCRUDScope == this.CRUDOPS.REMOTE) {
                        this.switchCRUD(this.CRUDOPS.LOCAL,em);
                    }
                    else {
                        this.switchCRUD(this.CRUDOPS.REMOTE,em);
                    }

                    this.notifyListeners(new mwf.Event("crud","changedScope"));
                }.bind(this);
            }
        }

    }

    mwf.xtends(ContentTaggerApplication,mwf.Application);

    var instance = new ContentTaggerApplication();

    return instance;

});