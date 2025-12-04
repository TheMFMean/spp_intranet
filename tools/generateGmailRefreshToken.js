// tools/generateGmailRefreshToken.js
//
// ============================================================================
// GMAIL OAUTH REFRESH TOKEN GENERATOR
// ============================================================================
//
// This script generates a fresh Gmail OAuth refresh token using the
// credentials in your .env file.
//
// PREREQUISITES:
// --------------
// 1. .env file must exist with:
//    - GMAIL_CLIENT_ID
//    - GMAIL_CLIENT_SECRET
//    - GMAIL_REDIRECT_URI (typically: urn:ietf:wg:oauth:2.0:oob)
//
// 2. Gmail API must be enabled in Google Cloud Console
//
// 3. OAuth2 credentials must be created (Desktop app type)
//
// HOW TO RUN:
// -----------
// cd /srv/backend
// node tools/generateGmailRefreshToken.js
//
// STEPS:
// ------
// 1. Script will print an authorization URL
// 2. Open that URL in your browser
// 3. Log in with the Soda Pop Gmail account
// 4. Grant permissions
// 5. Copy the authorization code from the browser
// 6. Paste it into the terminal when prompted
// 7. Script will print the refresh token
// 8. Copy the REFRESH_TOKEN=... line into your .env file
//
// ============================================================================

import dotenv from "dotenv";
import { google } from "googleapis";
import readline from "readline";

// Load environment variables
dotenv.config();

const {
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI,
} = process.env;

// Validate required environment variables
if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REDIRECT_URI) {
    console.error("❌ ERROR: Missing required environment variables in .env file");
    console.error("");
    console.error("Required variables:");
    console.error("  - GMAIL_CLIENT_ID");
    console.error("  - GMAIL_CLIENT_SECRET");
    console.error("  - GMAIL_REDIRECT_URI");
    console.error("");
    console.error("Current values:");
    console.error(`  GMAIL_CLIENT_ID: ${GMAIL_CLIENT_ID ? "✓ Set" : "✗ Missing"}`);
    console.error(`  GMAIL_CLIENT_SECRET: ${GMAIL_CLIENT_SECRET ? "✓ Set" : "✗ Missing"}`);
    console.error(`  GMAIL_REDIRECT_URI: ${GMAIL_REDIRECT_URI ? "✓ Set" : "✗ Missing"}`);
    console.error("");
    console.error("Please update your .env file and try again.");
    process.exit(1);
}

console.log("=".repeat(80));
console.log("GMAIL OAUTH REFRESH TOKEN GENERATOR");
console.log("=".repeat(80));
console.log("");
console.log("Loaded credentials from .env:");
console.log(`  Client ID: ${GMAIL_CLIENT_ID.substring(0, 20)}...`);
console.log(`  Client Secret: ${GMAIL_CLIENT_SECRET.substring(0, 10)}...`);
console.log(`  Redirect URI: ${GMAIL_REDIRECT_URI}`);
console.log("");

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
);

// Define scopes
const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
];

// Generate authorization URL
const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent screen to get refresh token
});

console.log("=".repeat(80));
console.log("STEP 1: AUTHORIZE THE APPLICATION");
console.log("=".repeat(80));
console.log("");
console.log("Open this URL in your browser:");
console.log("");
console.log(authUrl);
console.log("");
console.log("Instructions:");
console.log("  1. Click the URL above (or copy/paste into browser)");
console.log("  2. Log in with the Soda Pop Gmail account");
console.log("  3. Grant permissions to access Gmail (read-only)");
console.log("  4. You will see an authorization code");
console.log("  5. Copy that code");
console.log("");
console.log("=".repeat(80));
console.log("");

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Prompt for authorization code
rl.question("Paste the authorization code here: ", async (code) => {
    rl.close();

    if (!code || code.trim() === "") {
        console.error("");
        console.error("❌ ERROR: No authorization code provided");
        process.exit(1);
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("STEP 2: EXCHANGING CODE FOR TOKENS");
    console.log("=".repeat(80));
    console.log("");
    console.log("Exchanging authorization code for tokens...");

    try {
        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code.trim());

        console.log("");
        console.log("✅ SUCCESS! Tokens received.");
        console.log("");
        console.log("=".repeat(80));
        console.log("FULL TOKEN OBJECT");
        console.log("=".repeat(80));
        console.log("");
        console.log(JSON.stringify(tokens, null, 2));
        console.log("");
        console.log("=".repeat(80));
        console.log("REFRESH TOKEN (ADD THIS TO YOUR .env FILE)");
        console.log("=".repeat(80));
        console.log("");
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log("");
        console.log("=".repeat(80));
        console.log("NEXT STEPS");
        console.log("=".repeat(80));
        console.log("");
        console.log("1. Copy the line above: GMAIL_REFRESH_TOKEN=...");
        console.log("2. Open your .env file: nano /srv/backend/.env");
        console.log("3. Update or add the GMAIL_REFRESH_TOKEN line");
        console.log("4. Save the file");
        console.log("5. Test the Gmail poller: node workers/gmailPoller.js");
        console.log("");
        console.log("✅ Token generation complete!");
        console.log("");

        process.exit(0);
    } catch (error) {
        console.error("");
        console.error("❌ ERROR: Failed to exchange authorization code for tokens");
        console.error("");
        console.error("Error details:");
        console.error(`  Message: ${error.message}`);
        if (error.response?.data) {
            console.error(`  Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        console.error("");
        console.error("Common causes:");
        console.error("  - Invalid authorization code (expired or already used)");
        console.error("  - Incorrect GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET");
        console.error("  - OAuth2 client disabled in Google Cloud Console");
        console.error("  - Redirect URI mismatch");
        console.error("");
        console.error("Try again with a fresh authorization code.");
        console.error("");

        process.exit(1);
    }
});
