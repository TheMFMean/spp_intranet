# Gmail OAuth Token Generation Guide

## Quick Start

Generate a fresh Gmail OAuth refresh token:

```bash
cd /srv/backend
node tools/generateGmailRefreshToken.js
```

## Prerequisites

### 1. Environment Variables

Your `.env` file must have these three variables:

```bash
GMAIL_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-abc123def456
GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
```

**Note**: `GMAIL_REFRESH_TOKEN` is what you're generating - it doesn't need to exist yet.

### 2. Google Cloud Console Setup

1. Go to: https://console.cloud.google.com/
2. Select your project (or create one)
3. Enable Gmail API:
   - APIs & Services → Library
   - Search "Gmail API"
   - Click Enable
4. Create OAuth2 credentials:
   - APIs & Services → Credentials
   - Create Credentials → OAuth 2.0 Client ID
   - Application type: **Desktop app**
   - Name: "SPP Gmail Poller" (or any name)
   - Click Create
5. Copy the Client ID and Client Secret
6. Add them to your `.env` file

## Step-by-Step Process

### Step 1: Run the Script

```bash
cd /srv/backend
node tools/generateGmailRefreshToken.js
```

### Step 2: Open Authorization URL

The script will print a URL like:

```
https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=...
```

Copy and paste this URL into your browser.

### Step 3: Authorize

1. Log in with the **Soda Pop Gmail account**
2. You'll see: "SPP Gmail Poller wants to access your Google Account"
3. Click "Allow" or "Continue"
4. Grant permission to "Read your email messages and settings"

### Step 4: Copy Authorization Code

After granting permission, you'll see a page with an authorization code:

```
Please copy this code, switch to your application and paste it there:
4/0AY0e-g7abc123def456...
```

Copy this entire code.

### Step 5: Paste Code into Terminal

Go back to your terminal where the script is waiting:

```
Paste the authorization code here: 
```

Paste the code and press Enter.

### Step 6: Copy Refresh Token

The script will print:

```
✅ SUCCESS! Tokens received.

REFRESH TOKEN (ADD THIS TO YOUR .env FILE)
================================================================================

GMAIL_REFRESH_TOKEN=1//0abc123def456...

================================================================================
```

Copy the entire line: `GMAIL_REFRESH_TOKEN=1//0abc...`

### Step 7: Update .env File

```bash
nano /srv/backend/.env
```

Add or update the line:

```bash
GMAIL_REFRESH_TOKEN=1//0abc123def456...
```

Save and exit (Ctrl+X, Y, Enter).

### Step 8: Test

```bash
node workers/gmailPoller.js
```

If successful, you'll see the poller start fetching emails!

## Troubleshooting

### Error: "Missing required environment variables"

**Problem**: `.env` file doesn't have `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, or `GMAIL_REDIRECT_URI`.

**Fix**:
```bash
# Check what's in .env
cat .env | grep GMAIL

# Add missing variables
nano .env
```

### Error: "invalid_client"

**Problem**: `GMAIL_CLIENT_ID` or `GMAIL_CLIENT_SECRET` is incorrect.

**Fix**:
1. Go to Google Cloud Console → Credentials
2. Find your OAuth 2.0 Client ID
3. Copy the correct Client ID and Secret
4. Update `.env` file

### Error: "redirect_uri_mismatch"

**Problem**: `GMAIL_REDIRECT_URI` doesn't match what's configured in Google Cloud Console.

**Fix**:
1. Go to Google Cloud Console → Credentials → Your OAuth Client
2. Check "Authorized redirect URIs"
3. Add: `urn:ietf:wg:oauth:2.0:oob` (for desktop apps)
4. Or use: `http://localhost:3000/oauth2callback` (for web apps)
5. Update `GMAIL_REDIRECT_URI` in `.env` to match

### Error: "access_denied"

**Problem**: You clicked "Deny" or "Cancel" during authorization.

**Fix**: Run the script again and click "Allow" this time.

### Error: "invalid_grant" or "Token has been expired or revoked"

**Problem**: The authorization code expired (they expire quickly, usually within 10 minutes).

**Fix**: Run the script again and paste the code faster.

### Authorization Code Already Used

**Problem**: You tried to use the same authorization code twice.

**Fix**: Get a fresh authorization code by running the script again.

## Understanding the Redirect URI

### For Desktop Apps (Recommended)

```bash
GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
```

This is the standard redirect URI for desktop/CLI applications. Google will show the authorization code on a page that you can copy.

### For Web Apps

```bash
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback
```

This would redirect to a local web server. Not needed for this CLI script.

## Security Notes

- ⚠️ The refresh token is sensitive - treat it like a password
- ⚠️ Never commit `.env` to git (already in `.gitignore`)
- ⚠️ Refresh tokens don't expire but can be revoked
- ⚠️ You can revoke access at: https://myaccount.google.com/permissions
- ✅ The script doesn't save tokens to disk (only prints them)
- ✅ Use the Soda Pop Gmail account (not personal accounts)

## What the Script Does

1. Loads credentials from `.env`
2. Creates OAuth2 client with Client ID, Secret, and Redirect URI
3. Generates authorization URL with scope: `gmail.readonly`
4. Waits for you to authorize and paste the code
5. Exchanges authorization code for tokens
6. Prints the refresh token
7. Exits

## Token Lifecycle

```
┌─────────────────┐
│ Client ID       │
│ Client Secret   │  ──┐
│ Redirect URI    │    │
└─────────────────┘    │
                       ▼
              ┌──────────────────┐
              │ Authorization URL │
              └──────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ User Authorizes   │
              └──────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Authorization Code│
              └──────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Exchange for      │
              │ Refresh Token     │
              └──────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ GMAIL_REFRESH_    │
              │ TOKEN=1//0abc...  │
              └──────────────────┘
```

## Scopes

The script requests this scope:

- `https://www.googleapis.com/auth/gmail.readonly` - Read-only access to Gmail

This allows the poller to:
- ✅ Read email messages
- ✅ List messages
- ✅ Get message details
- ❌ Send emails (not granted)
- ❌ Delete emails (not granted)
- ❌ Modify emails (not granted)

## Files

- **Token Generator**: `tools/generateGmailRefreshToken.js`
- **Gmail Client**: `services/gmailClient.js` (uses the refresh token)
- **Gmail Poller**: `workers/gmailPoller.js` (fetches emails)
- **Environment**: `.env` (stores credentials)
- **Credential Map**: `notes/gmail_oauth_credentials_map.md`

## Related Documentation

- [Gmail OAuth Credentials Map](gmail_oauth_credentials_map.md)
- [Inventory Lifecycle Smoke Test](inventory_lifecycle_smoketest.md)

## Quick Reference

```bash
# Generate refresh token
cd /srv/backend
node tools/generateGmailRefreshToken.js

# Update .env with the token
nano .env

# Test Gmail poller
node workers/gmailPoller.js

# Check environment variables
node -e "require('dotenv').config(); console.log('Token:', process.env.GMAIL_REFRESH_TOKEN?.substring(0, 20) + '...');"
```
