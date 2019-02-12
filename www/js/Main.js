/**
 * Created by master on 14.01.16, substantially updated on 12.02.19
 */

// import the framework
import * as mwf from "../lib/js/mwf/mwf.js";

/* import the generic components for applications */
import GenericDialogTemplateViewController from "../../lib/js/mwf/controller/mwfGenericDialogTemplateViewController.js";
import * as mapHolder from "../../lib/js/mwf/controller/mwfMapHolderLeaflet.js";

/* application libraries: the main application class */
import ContentTaggerApplication from "./ContentTaggerApplication.js";
import * as entities from "./model/Entities.js";
/* application libraries: controller for generic elements */
import TagSelectionDialogViewController from "./controller/TagSelectionDialogViewController.js";
import SidemenuViewController from "./controller/SidemenuViewController.js";
import MapViewController from "./controller/MapViewController.js";
/* ... for tags */
import TagsOverviewViewController from "./controller/TagsOverviewViewController.js";
import TaggableOverviewViewController from "./controller/TaggableOverviewViewController.js";
/* ... for notes */
import NotesOverviewViewController from "./controller/NotesOverviewViewController.js";
import NotesEditviewViewController from "./controller/NotesEditviewViewController.js";
import NotesReadviewViewController from "./controller/NotesReadviewViewController.js";
/* ... for places */
import PlacesOverviewViewController from "./controller/PlacesOverviewViewController.js";
import PlacesEditviewViewController from "./controller/PlacesEditviewViewController.js";

export {
    GenericDialogTemplateViewController,
    mapHolder,
    ContentTaggerApplication,
    entities,
    TagSelectionDialogViewController,
    SidemenuViewController,
    MapViewController,
    TagsOverviewViewController,
    TaggableOverviewViewController,
    NotesOverviewViewController,
    NotesEditviewViewController,
    NotesReadviewViewController,
    PlacesOverviewViewController,
    PlacesEditviewViewController
}

// then start the application
window.onload = () => {
    mwf.onloadApplication();
}

