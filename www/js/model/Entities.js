/**
 * @author Jörn Kreutel
 *
 * this skript defines the data types used by the application and the model operations for handling instances of the latter
 */

/*
 * a global counter for ids
 */
define(["mwfUtils", "EntityManager", "GenericCRUDImplLocal"], function (mwfUtils, EntityManager, GenericCRUDImplLocal) {


    /*************
     * Taggable
     *************/

    function Taggable() {
        this.instantiateManagedAttributes();
    }

    // use EntityManager.xtends in order to add entity-specific behaviour
    EntityManager.xtends(Taggable, EntityManager.Entity);
    // TODO: the redundancy of inverse declaration is highly suboptimal... need to think of an alternative solution, e.g. processing managedAttributes once instantiateManagedAttributes is called the first time?
    EntityManager.Entity.prototype.declareManagedAttribute(Taggable, "tags", "Tag", {
        multiple: true,
        inverse: "contentItems"
    });

    /* the ordering is relevant here, all subclasses of taggable need to be declared afterwards, otherwise the managed attributes declaration will be missing! */

    /*************
     * Tag
     *************/

    function Tag(name, description) {
        this.name = name;
        this.description = description;
        this.instantiateManagedAttributes();
    }

    // use EntityManager.xtends in order to add entity-specific behaviour
    EntityManager.xtends(Tag, EntityManager.Entity);
    // the inverse declarations are redundant!!!
    EntityManager.Entity.prototype.declareManagedAttribute(Tag, "contentItems", "Taggable", {
        multiple: true,
        allowTransient: true,
        inverse: "tags",
        lazyload: true
    });

    /*************
     * Note
     *************/

    function Note(name, content) {
        this.name = name;
        this.content = content;
        this.lastModified = Date.now();

        this.test = function () {
            return lastModified;
        }

        this.markModified = function () {
            this.lastModified = Date.now();
        }

        this.instantiateManagedAttributes();
    }

    // use EntityManager.xtends in order to add entity-specific behaviour
    EntityManager.xtends(Note, Taggable);

    // specifiy specific getters for date format
    Object.defineProperty(Note.prototype, "lastModifiedDateString", {
        get: function () {
            return (new Date(this.lastModified)).toLocaleDateString();
        }
    });
    Object.defineProperty(Note.prototype, "lastModifiedTimeString", {
        get: function () {
            return (new Date(this.lastModified)).toLocaleTimeString();
        }
    });

    /*************
     * Location
     *************/

    /* the location type will not be dealt with as an entity in order to be simply embeddable - there will be a specific place entity for this purpose */
    function Location(lat, lng, name) {
        this.lat = lat;
        this.lng = lng;
        this.name = name ? name : null;
    }

    /*****************
     * Place (Entity)
     *****************/

    function Place(name) {
        this.name = name;

        this.instantiateManagedAttributes();
    }

    // use EntityManager.xtends in order to add entity-specific behaviour
    EntityManager.xtends(Place, Taggable);


    return {
        Place: Place,
        Location: Location,
        Tag: Tag,
        Note: Note
    }

});
