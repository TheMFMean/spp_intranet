# Gmail OAuth Credentials Map

## Location of Gmail Client Code

**File**: `services/gmailClient.js`

**Function**: `createGmailClient()`

## Credential Sources

All credentials are loaded from **environment variables** (`.env` file):

| Credential | Environment Variable | Example Value |
|------------|---------------------|---------------|
| **Client ID** | `GMAIL_CLIENT_ID` | `123456789-abcdefg.apps.googleusercontent.com` |
| **Client Secret** | `GMAIL_CLIENT_SECRET` | `GOCSPX-abc123def456` |
| **Redirect URI** | `GMAIL_REDIRECT_URI` | `http://localhost:3000/oauth2callback` or `urn:ietf:wg:oauth:2.0:oob` |
| **Refresh Token** | `GMAIL_REFRESH_TOKEN` | `1//0abc123def456...` |

## No Local Files

This implementation does **NOT** use:
- ❌ `credentials.json` (not present in repo)
- ❌ `token.json` (not present in repo)
- ❌ Hardcoded credentials

All values come from environment variables loaded via `dotenv` in `workers/gmailPoller.js`.

## OAuth2 Flow

```javascript
// 1. Create OAuth2 client with credentials
const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,      // from process.env
    GMAIL_CLIENT_SECRET,  // from process.env
    GMAIL_REDIRECT_URI    // from process.env
);

// 2. Set refresh token
oAuth2Client.setCredentials({
    refresh_token: GMAIL_REFRESH_TOKEN  // from process.env
});

// 3. Create Gmail API client
return google.gmail({ version: "v1", auth: oAuth2Client });
```

## Current Error: `invalid_client`

**Error Message:**
```
GaxiosError: invalid_client from https://oauth2.googleapis.com/token
```

**What This Means:**
- The `GMAIL_CLIENT_ID` or `GMAIL_CLIENT_SECRET` is incorrect
- The OAuth2 client was deleted or disabled in Google Cloud Console
- The credentials are from a different Google Cloud project
- The client ID and secret don't match

## How to Fix

### Step 1: Verify Credentials in Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Select your project
3. Navigate to: **APIs & Services → Credentials**
4. Find your OAuth 2.0 Client ID (type: Desktop app or Web application)
5. Click on the client name to view details
6. Copy the **Client ID** and **Client secret**

### Step 2: Update .env File

Edit `/srv/backend/.env`:

```bash
GMAIL_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-actual-client-secret
GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
GMAIL_REFRESH_TOKEN=your-refresh-token
```

### Step 3: Verify Environment Variables Load

```bash
cd /srv/backend
node -e "require('dotenv').config(); console.log('Client ID:', process.env.GMAIL_CLIENT_ID?.substring(0, 20) + '...');"
```

### Step 4: Test Gmail Client

```bash
node workers/gmailPoller.js
```

## Generating a New Refresh Token

If you need to generate a new refresh token:

### Option 1: Using OAuth2 Playground

1. Go to: https://developers.google.com/oauthplayground/
2. Click gear icon (⚙️) → Use your own OAuth credentials
3. Enter your Client ID and Client Secret
4. In Step 1: Select "Gmail API v1" → `https://www.googleapis.com/auth/gmail.readonly`
5. Click "Authorize APIs"
6. Sign in with your Google account
7. In Step 2: Click "Exchange authorization code for tokens"
8. Copy the **Refresh token**
9. Add to `.env`: `GMAIL_REFRESH_TOKEN=1//0abc...`

### Option 2: Using a Script

Create `scripts/generateGmailToken.js`:

```javascript
import { google } from "googleapis";
import readline from "readline";

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
});

console.log("Authorize this app by visiting this url:", authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question("Enter the code from that page here: ", async (code) => {
    rl.close();
    const { tokens } = await oauth2Client.getToken(code);
    console.log("Refresh token:", tokens.refresh_token);
});
```

Run:
```bash
node scripts/generateGmailToken.js
```

## Required .env Variables

Minimum required for Gmail poller:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/piercely

# Gmail OAuth2
GMAIL_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-abc123def456
GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
GMAIL_REFRESH_TOKEN=1//0abc123def456...

# Optional
JWT_SECRET=your-secret-key
NODE_ENV=development
```

## Checking Current Configuration

```bash
# Check if .env exists
ls -la /srv/backend/.env

# Check if Gmail variables are set (without revealing values)
cd /srv/backend
grep GMAIL .env | sed 's/=.*/=***/'

# Test loading environment variables
node -e "require('dotenv').config(); console.log('Variables loaded:', !!process.env.GMAIL_CLIENT_ID);"
```

## Related Files

- **Gmail Client**: `services/gmailClient.js` (OAuth2 setup)
- **Gmail Poller**: `workers/gmailPoller.js` (uses createGmailClient)
- **Email Extractor**: `services/emailExtractor.js` (fetches message content)
- **Environment**: `.env` (credentials storage)
- **Example**: `.env.example` (template)

## Security Notes

- ⚠️ Never commit `.env` to git (already in `.gitignore`)
- ⚠️ Never hardcode credentials in source files
- ⚠️ Refresh tokens are long-lived but can be revoked
- ⚠️ Access tokens are short-lived (auto-refreshed by googleapis library)
- ✅ All credentials come from environment variables
- ✅ No credential files in repository

## Next Steps

1. Verify credentials in Google Cloud Console
2. Update `.env` with correct values
3. Test: `node workers/gmailPoller.js`
4. If still failing, regenerate refresh token
5. Verify Gmail API is enabled in Google Cloud Console
