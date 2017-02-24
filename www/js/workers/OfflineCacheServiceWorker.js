/**
 * Created by master on 24.02.17.
 */

// for debugging workers, see: about:debugging
// for more: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
this.addEventListener('install', function(event) {
    console.log("service worker was installed...");
});
