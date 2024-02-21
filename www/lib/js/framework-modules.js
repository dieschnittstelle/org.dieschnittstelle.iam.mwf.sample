/*
 * this module explicitly imports the concrete implementations of framework
 * modules exports them. All dependencies of framework modules among each
 * other are resolved using this module, such that the modules themselves
 * are agnostic with regard to the implementations of their dependencies.
 *
 * Additionally, we import the Main.js module, which provides all application
 * resources that need to be instantiated dynamically at runtime.
 */

/* base */
import * as mwf from "./mwf/mwf.js";
import * as mwfUtils from "./mwf/mwfUtils.js";
import * as eventhandling from "./mwf/mwfEventhandling.js";
/* crud */
import * as EntityManager from "./mwf/crud/mwfEntityManager.js";
import * as GenericCRUDImplLocal from "./mwf/crud/mwfGenericCRUDImplLocal.js";
import * as GenericCRUDImplRemote from "./mwf/crud/mwfGenericCRUDImplRemote.js";
import * as indexeddb from "./mwf/crud/mwfIndexeddb.js";
import * as xhr from "./mwf/crud/mwfXhr.js";
/* controller */
import GenericDialogTemplateViewController from "./mwf/controller/mwfGenericDialogTemplateViewController.js";
/* TODO: only include the mapHolder if maps are actually used. Do not forget to export it below */
import mapHolder from "./mwf/controller/mwfMapHolderLeaflet.js";

export {
    mwf,
    mwfUtils,
    eventhandling,
    EntityManager,
    GenericCRUDImplLocal,
    GenericCRUDImplRemote,
    indexeddb,
    xhr,
    GenericDialogTemplateViewController,
    /* TODO: export the mapHolder in case it is used by the application */
    mapHolder
}