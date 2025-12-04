// /srv/backend/services/gmailClient.js
//
// ============================================================================
// GMAIL OAUTH CREDENTIALS MAPPING
// ============================================================================
//
// This file creates the Gmail API client using OAuth2 authentication.
// All credentials are loaded from ENVIRONMENT VARIABLES (not files).
//
// CREDENTIAL SOURCES:
// -------------------
// Client ID source:       process.env.GMAIL_CLIENT_ID
// Client secret source:   process.env.GMAIL_CLIENT_SECRET
// Redirect URI source:    process.env.GMAIL_REDIRECT_URI
// Refresh token source:   process.env.GMAIL_REFRESH_TOKEN
//
// EXPECTED .env FORMAT:
// ---------------------
// GMAIL_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
// GMAIL_CLIENT_SECRET=GOCSPX-abc123def456
// GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback (or urn:ietf:wg:oauth:2.0:oob)
// GMAIL_REFRESH_TOKEN=1//0abc123def456...
//
// OAUTH2 FLOW:
// ------------
// 1. OAuth2Client is instantiated with client_id, client_secret, redirect_uri
// 2. Refresh token is set via setCredentials({ refresh_token: ... })
// 3. Google APIs library automatically exchanges refresh token for access token
// 4. Access token is used for Gmail API requests
//
// ERROR: "invalid_client" from oauth2.googleapis.com/token
// --------------------------------------------------------
// This error typically means:
// - GMAIL_CLIENT_ID is incorrect or doesn't match the project
// - GMAIL_CLIENT_SECRET is incorrect
// - The OAuth2 client was deleted or disabled in Google Cloud Console
// - The credentials are from a different Google Cloud project
//
// TO FIX:
// -------
// 1. Go to Google Cloud Console: https://console.cloud.google.com/
// 2. Select your project
// 3. Navigate to: APIs & Services → Credentials
// 4. Find your OAuth 2.0 Client ID (type: Desktop app or Web application)
// 5. Copy the Client ID and Client Secret
// 6. Update .env file with correct values
// 7. If refresh token is also invalid, regenerate it using OAuth2 flow
//
// NO LOCAL FILES:
// ---------------
// This implementation does NOT use:
// - credentials.json (not present in repo)
// - token.json (not present in repo)
// - Any hardcoded credentials
//
// All values come from environment variables loaded via dotenv in workers/gmailPoller.js
//
// ============================================================================

import { google } from "googleapis";

export function createGmailClient() {
  const {
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI,
    GMAIL_REFRESH_TOKEN,
  } = process.env;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REDIRECT_URI || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Missing GMAIL_* env vars, check your .env file");
  }

  const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  );

  oAuth2Client.setCredentials({
    refresh_token: GMAIL_REFRESH_TOKEN,
  });

  return google.gmail({ version: "v1", auth: oAuth2Client });
}
