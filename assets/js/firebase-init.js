/* ============================================================
 *  FIREBASE INITIALISATION (compat SDK, no build step required)
 *  Exposes window.FB = { ready, app, auth, db, storage, FieldValue, serverTimestamp }
 * ============================================================ */
(function () {
  "use strict";

  const cfg = window.firebaseConfig || {};
  const isPlaceholder =
    !cfg.apiKey ||
    String(cfg.apiKey).startsWith("PASTE_") ||
    !cfg.projectId ||
    String(cfg.projectId).startsWith("PASTE_");

  const FB = {
    ready: false,
    configured: !isPlaceholder,
    app: null,
    auth: null,
    db: null,
    storage: null,
    FieldValue: null,
    serverTimestamp: null,
    error: null
  };
  window.FB = FB;

  if (isPlaceholder) {
    console.warn(
      "[firebase-init] Firebase is not configured yet. " +
        "Paste your credentials in firebase-config.js. " +
        "The UI will still render with empty states."
    );
    document.dispatchEvent(new CustomEvent("fb:state", { detail: FB }));
    return;
  }

  try {
    if (!window.firebase || !firebase.initializeApp) {
      throw new Error("Firebase SDK failed to load (check your network / CDN).");
    }
    FB.app = firebase.initializeApp(cfg);
    FB.auth = firebase.auth();
    FB.db = firebase.firestore();
    FB.storage = firebase.storage();
    FB.FieldValue = firebase.firestore.FieldValue;
    FB.serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
    try {
      FB.db.settings({ ignoreUndefinedProperties: true });
    } catch (e) {}
    FB.ready = true;
    console.info("[firebase-init] Firebase initialised for project:", cfg.projectId);
  } catch (err) {
    FB.error = err.message || String(err);
    console.error("[firebase-init]", err);
  }

  document.dispatchEvent(new CustomEvent("fb:state", { detail: FB }));
})();
