// /srv/backend/workers/gmailPoller.js
// THIN WRAPPER - redirects to gmailPollerUnified.js
//
// This file exists for backward compatibility.
// All new development should use gmailPollerUnified.js directly.

console.log("\n⚠️  gmailPoller.js is deprecated - redirecting to gmailPollerUnified.js\n");

import("./gmailPollerUnified.js");
