/**
 * @author Jörn Kreutel
 *
 * this skript defines the data types used by the application and the model operations for handling instances of the latter
 */

/*
 * a global counter for ids
 */

import {mwfUtils} from "../Main.js";
import {EntityManager} from "../Main.js";

/*************
 * Taggable
 *************/

class Taggable extends EntityManager.Entity {

}

// TODO: the redundancy of inverse declaration is suboptimal... need to think of an alternative solution, e.g. processing managedAttributes once instantiateManagedAttributes is called the first time?
EntityManager.Entity.prototype.declareManagedAttribute(Taggable, "tags", "Tag", {
    multiple: true,
    inverse: "contentItems"
});

/* the ordering is relevant here, all subclasses of taggable need to be declared afterwards, otherwise the managed attributes declaration will be missing! */

/*************
 * Tag
 *************/

class Tag extends EntityManager.Entity {

    constructor(name, description) {
        super();

        this.name = name;
        this.description = description;
    }

}

// the inverse declarations are redundant
EntityManager.Entity.prototype.declareManagedAttribute(Tag, "contentItems", "Taggable", {
    multiple: true,
    allowTransient: true,
    inverse: "tags",
    lazyload: true
});

/*************
 * Note
 *************/

class Note extends Taggable {

    constructor(name, content) {
        super();

        this.name = name;
        this.content = content;
        this.lastModified = Date.now();
    }

    test() {
        return lastModified;
    }

    markModified() {
        this.lastModified = Date.now();
    }

}

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
class Location {

    constructor(lat, lng, name) {
        this.lat = lat;
        this.lng = lng;
        this.name = name ? name : null;
    }

}

/*****************
 * Place (Entity)
 *****************/

class Place extends Taggable {

    constructor(name,location) {
        super();

        this.name = name;
        this.location = location;
    }

    getLatlng() {
        return [this.location.lat, this.location.lng];
    }

}

export {
    Place,
    Location,
    Tag,
    Note
}

