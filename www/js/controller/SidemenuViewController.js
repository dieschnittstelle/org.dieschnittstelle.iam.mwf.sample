/**
 * @author Jörn Kreutel
 */
import {mwf} from "../Main.js";
import {entities} from "../Main.js";

console.log("loading module...");

export default class SidemenuViewController extends mwf.SidemenuViewController {

    constructor() {
        console.log("<constructor>");
        super();
    }

    // here, the default action should be called at the end after handling, e.g., particular actions locally
    onMenuItemSelected(item) {
        console.log("onMenuItemSelected()");

        if (item.getAttribute("data-mwf-id") == "mainmenu-reset") {
            if (confirm("Sollen alle lokalen Daten zurückgesetzt werden?")) {
                var request = indexedDB.deleteDatabase("mwfdb");
                request.onsuccess = function() {
                    alert("Daten wurden zurückgesetzt. Refresh sollte ausgeführt werden!");
                }
                request.onerror = function() {
                    alert("Zurücksetzen fehlgeschlagen! Versuchen Sie einen Neustart des Browsers durchzuführen.");
                }
            }
        }
        else {
            super.onMenuItemSelected(item);
        }
    }

}

