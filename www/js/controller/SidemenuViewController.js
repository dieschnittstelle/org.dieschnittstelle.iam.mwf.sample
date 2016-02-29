/**
 * @author Jörn Kreutel
 */
define(["mwf","mwfUtils"], function(mwf,mwfUtils) {
    console.log("loading module...");

    function SidemenuViewController() {

        var proto = SidemenuViewController.prototype;

        // here, the default action should be called at the end after handling, e.g., particular actions locally
        this.onMenuItemSelected = function(item) {

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
                proto.onMenuItemSelected.call(this, item);
            }

        }

    }

    // we extend the generic vc for the side menu
    mwf.xtends(SidemenuViewController,mwf.SidemenuViewController);

    return SidemenuViewController;

});

