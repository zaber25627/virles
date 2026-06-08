/* ============================================================
 *  FIREBASE CONFIGURATION
 *  ------------------------------------------------------------
 *  PASTE YOUR OWN FIREBASE CREDENTIALS BELOW.
 *
 *  Get them from:
 *    Firebase Console -> Project Settings -> General
 *    -> "Your apps" -> SDK setup and configuration -> Config
 *
 *  Also set your Telegram admin id(s) in ADMIN_IDS so the
 *  admin panel only opens for you.
 * ============================================================ */

window.firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
  measurementId: "PASTE_YOUR_MEASUREMENT_ID" // optional
};

/* Telegram numeric user id(s) allowed to open the admin panel. */
window.ADMIN_IDS = [
  // 123456789,
];

/* App-level defaults (can be overridden from the admin "settings" doc). */
window.APP_DEFAULTS = {
  appName: "Premium Mini App",
  currencyName: "Coins",
  currencySymbol: "₵",
  logoText: "PM",          // initials used in the loading logo
  welcomeMessage: "Welcome to your premium earning hub.",
  maintenanceMode: false
};
