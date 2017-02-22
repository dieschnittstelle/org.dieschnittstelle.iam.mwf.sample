/**
 * @author Jörn Kreutel
 */
define(["mwf","mwfUtils"], function(mwf,mwfUtils) {
    console.log("loading module...");

    class SidemenuViewController extends mwf.SidemenuViewController {

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

    return SidemenuViewController;

});

