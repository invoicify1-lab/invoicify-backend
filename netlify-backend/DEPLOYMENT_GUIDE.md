# 🚀 Invoicify Backend - Deployment Guide

Complete step-by-step guide to deploy your Netlify Functions backend.

---

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Netlify account (free tier works!)
- [ ] Google Cloud account (for Sheets API)
- [ ] OpenAI account (for GPT-4 Vision)
- [ ] Access to Google Spreadsheet: `1rJvNFRdOlMuYxbkoePWXmkE0yxxBnldB5Y6jTjSLu1Q`

---

## Step 1: Set Up Google Sheets API

### 1.1 Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one
3. **Enable APIs**:
   - Search for "Google Sheets API"
   - Click "Enable"
4. Go to **"IAM & Admin"** > **"Service Accounts"**
5. Click **"Create Service Account"**
   - Name: `invoicify-backend`
   - Description: `Service account for Invoicify API`
6. Click **"Create and Continue"**
7. Skip roles (click Continue)
8. Click **"Done"**

### 1.2 Generate JSON Key

1. Click on the service account you just created
2. Go to **"Keys"** tab
3. Click **"Add Key"** > **"Create new key"**
4. Select **"JSON"**
5. Click **"Create"**
6. **Save the JSON file** - you'll need this!

The JSON will look like:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "invoicify-backend@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

### 1.3 Share Google Sheet with Service Account

⚠️ **CRITICAL STEP** - Your API won't work without this!

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1rJvNFRdOlMuYxbkoePWXmkE0yxxBnldB5Y6jTjSLu1Q/edit
2. Click **"Share"** button (top right)
3. Copy the `client_email` from your JSON key
   - Example: `invoicify-backend@your-project.iam.gserviceaccount.com`
4. Paste it in the share field
5. Set permissions to **"Editor"**
6. Click **"Share"**

---

## Step 2: Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to **API Keys** section
4. Click **"Create new secret key"**
5. Name it `invoicify-backend`
6. **Copy the key** (starts with `sk-proj-...`)
7. Save it securely - you can't see it again!

**Cost Estimate**: ~$0.01-0.05 per invoice with GPT-4 Vision

---

## Step 3: Deploy to Netlify

### Option A: Deploy via GitHub (Recommended)

#### 3.1 Push Code to GitHub

```bash
cd netlify-backend

# Initialize git (if not already)
git init

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/invoicify-backend.git

# Add files
git add .
git commit -m "Initial commit - Invoicify backend"

# Push
git push -u origin main
```

#### 3.2 Connect to Netlify

1. Go to [Netlify](https://app.netlify.com/)
2. Click **"Add new site"** > **"Import an existing project"**
3. Choose **"GitHub"**
4. Select your repository
5. Build settings:
   - **Base directory**: (leave empty)
   - **Build command**: (leave empty)
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
6. Click **"Deploy site"**

#### 3.3 Configure Environment Variables

1. Go to **Site settings** > **Environment variables**
2. Click **"Add a variable"**
3. Add both variables:

**Variable 1**:
- Key: `GOOGLE_SERVICE_ACCOUNT_KEY`
- Value: **Entire JSON content** from Step 1.2 (paste the whole JSON object)
- Scope: All scopes

**Variable 2**:
- Key: `OPENAI_API_KEY`
- Value: Your OpenAI key from Step 2 (e.g., `sk-proj-...`)
- Scope: All scopes

4. Click **"Save"**

#### 3.4 Redeploy

1. Go to **Deploys** tab
2. Click **"Trigger deploy"** > **"Clear cache and deploy site"**
3. Wait for deployment to complete (~2 minutes)

---

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Set environment variables
netlify env:set GOOGLE_SERVICE_ACCOUNT_KEY '{"type":"service_account",...}'
netlify env:set OPENAI_API_KEY 'sk-proj-...'

# Deploy
netlify deploy --prod
```

---

## Step 4: Test Your Deployment

### 4.1 Get Your Site URL

After deployment, you'll get a URL like:
```
https://YOUR_SITE_NAME.netlify.app
```

### 4.2 Test Endpoints

**Test Page**: Open `https://YOUR_SITE_NAME.netlify.app/` in browser

Or use cURL:

```bash
# Test validate-access
curl -X POST https://YOUR_SITE_NAME.netlify.app/.netlify/functions/validate-access \
  -H "Content-Type: application/json" \
  -d '{"access_code":"DEMO-2026"}'

# Expected response:
# {"ok":true,"plan":"starter","usage":0,"limit":50,...}
```

### 4.3 Full Test Checklist

- [ ] ✅ Validate access returns user data
- [ ] ✅ Get invoices returns empty array (initially)
- [ ] ✅ Update settings works
- [ ] ✅ Create invoice processes file and returns invoice

---

## Step 5: Connect Your Frontend

### Update Frontend API URL

In your React/Vue/HTML frontend, set the API base URL:

```javascript
const API_URL = 'https://YOUR_SITE_NAME.netlify.app/.netlify/functions';

// Example: Create invoice
async function createInvoice(accessCode, file, customerName, customerEmail, jobNotes) {
  const formData = new FormData();
  formData.append('access_code', accessCode);
  formData.append('file', file);
  formData.append('customer_name', customerName);
  formData.append('customer_email', customerEmail);
  formData.append('job_notes', jobNotes);

  const response = await fetch(`${API_URL}/create-invoice`, {
    method: 'POST',
    body: formData
  });

  return await response.json();
}
```

---

## 🔧 Troubleshooting

### Issue: "GOOGLE_SERVICE_ACCOUNT_KEY not found"

**Cause**: Environment variable not set correctly

**Fix**:
1. Go to Netlify Dashboard > Site Settings > Environment Variables
2. Verify `GOOGLE_SERVICE_ACCOUNT_KEY` exists
3. Make sure it's valid JSON (entire object from Google Cloud)
4. Redeploy the site

---

### Issue: "Failed to lookup user"

**Cause**: Service account doesn't have access to Google Sheet

**Fix**:
1. Open Google Sheet
2. Click Share
3. Add service account email: `YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com`
4. Give Editor permissions
5. Retry API call

---

### Issue: "OpenAI API error: Invalid API key"

**Cause**: Wrong or expired OpenAI key

**Fix**:
1. Go to [OpenAI Dashboard](https://platform.openai.com/api-keys)
2. Create new API key
3. Update `OPENAI_API_KEY` in Netlify environment variables
4. Redeploy

---

### Issue: "Rate limit exceeded"

**Cause**: Too many requests from same access code

**Fix**:
- Wait 1 minute and retry
- For production: Implement Redis-based rate limiting

---

### Issue: Functions timeout (10 seconds)

**Cause**: OpenAI API taking too long

**Fix**:
1. Increase function timeout in `netlify.toml`:
```toml
[functions]
  timeout = 26
```
2. Redeploy

---

## 📊 Monitoring

### View Function Logs

1. Go to Netlify Dashboard
2. Click **"Functions"** tab
3. Click on a function name
4. View recent invocations and logs

### Set Up Alerts

1. Go to **Site settings** > **Build & deploy**
2. Enable deploy notifications
3. Connect to Slack/email for alerts

---

## 🎯 Production Optimizations

### 1. Custom Domain

1. Go to **Site settings** > **Domain management**
2. Add custom domain
3. Configure DNS
4. Enable HTTPS (automatic)

### 2. Restrict CORS

Update CORS headers to only allow your frontend domain:

```javascript
// In each function file
const headers = {
  'Access-Control-Allow-Origin': 'https://your-frontend.com',
  // ...
};
```

### 3. Add API Authentication

Consider adding API key or JWT authentication for production.

### 4. Implement Real PDF Generation

Replace mock PDF generation with Puppeteer or PDF API:

```bash
npm install @sparticuz/chromium-min puppeteer-core
```

### 5. Set Up Error Monitoring

Integrate Sentry or LogRocket for error tracking.

---

## ✅ Deployment Checklist

- [ ] Google Sheets API enabled
- [ ] Service account created with JSON key
- [ ] Google Sheet shared with service account
- [ ] OpenAI API key obtained
- [ ] Code pushed to GitHub
- [ ] Netlify site created and connected
- [ ] Environment variables set in Netlify
- [ ] Site deployed successfully
- [ ] All 4 endpoints tested and working
- [ ] Frontend connected to backend
- [ ] Custom domain configured (optional)
- [ ] CORS restricted to frontend domain
- [ ] Error monitoring set up

---

## 🎉 You're Live!

Your Netlify Functions backend is now deployed and ready to power your Invoicify portal!

**Next Steps**:
1. Test with real invoices
2. Monitor logs for errors
3. Optimize based on usage patterns
4. Scale as needed (Netlify auto-scales!)

**Your Endpoints**:
```
POST   https://YOUR_SITE.netlify.app/.netlify/functions/validate-access
POST   https://YOUR_SITE.netlify.app/.netlify/functions/create-invoice
GET    https://YOUR_SITE.netlify.app/.netlify/functions/get-invoices
POST   https://YOUR_SITE.netlify.app/.netlify/functions/update-settings
```

Need help? Check the logs in Netlify Dashboard or review the README.md.

Happy invoicing! 🚀
