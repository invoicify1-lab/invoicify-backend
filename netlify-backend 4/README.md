# Invoicify Netlify Functions Backend

Complete backend API for Invoicify portal using Netlify Functions + Google Sheets.

## 📁 Project Structure

```
netlify-backend/
├── netlify/
│   └── functions/
│       ├── utils/
│       │   ├── google-sheets.js      # Google Sheets operations
│       │   └── invoice-generator.js   # AI extraction & PDF generation
│       ├── validate-access.js         # POST /.netlify/functions/validate-access
│       ├── create-invoice.js          # POST /.netlify/functions/create-invoice
│       ├── get-invoices.js            # GET  /.netlify/functions/get-invoices
│       └── update-settings.js         # POST /.netlify/functions/update-settings
├── package.json
├── netlify.toml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd netlify-backend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `netlify-backend/` directory:

```bash
# Google Sheets API (Service Account)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# OpenAI API (for invoice extraction)
OPENAI_API_KEY=sk-proj-...
```

#### Getting Google Service Account Key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Sheets API**
4. Go to "IAM & Admin" > "Service Accounts"
5. Create service account
6. Generate JSON key
7. Copy entire JSON content to `GOOGLE_SERVICE_ACCOUNT_KEY`
8. **IMPORTANT**: Share your Google Sheet with the service account email

#### Sharing Google Sheet:

1. Open: https://docs.google.com/spreadsheets/d/1rJvNFRdOlMuYxbkoePWXmkE0yxxBnldB5Y6jTjSLu1Q/edit
2. Click "Share"
3. Add service account email (e.g., `invoicify@PROJECT_ID.iam.gserviceaccount.com`)
4. Give "Editor" permissions

#### Getting OpenAI API Key:

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create account or login
3. Go to API Keys section
4. Create new secret key
5. Copy to `OPENAI_API_KEY`

### 3. Test Locally

```bash
npm run dev
```

This starts Netlify Dev server on http://localhost:8888

### 4. Deploy to Netlify

#### Option A: Netlify CLI

```bash
# Login
npx netlify login

# Link to site (or create new)
npx netlify link

# Set environment variables
npx netlify env:set GOOGLE_SERVICE_ACCOUNT_KEY '{"type":"service_account",...}'
npx netlify env:set OPENAI_API_KEY 'sk-proj-...'

# Deploy
npm run deploy
```

#### Option B: Netlify UI

1. Push code to GitHub
2. Go to [Netlify](https://app.netlify.com/)
3. "Add new site" > "Import from Git"
4. Select your repository
5. Build settings:
   - Build command: (leave empty)
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
6. Add environment variables in Site Settings > Environment Variables
7. Deploy!

---

## 📡 API Endpoints

Base URL (after deployment): `https://YOUR_SITE.netlify.app/.netlify/functions/`

### 1. Validate Access Code

**Endpoint**: `POST /.netlify/functions/validate-access`

**Request**:
```json
{
  "access_code": "DEMO-2026"
}
```

**Response**:
```json
{
  "ok": true,
  "plan": "starter",
  "usage": 5,
  "limit": 50,
  "company_profile": {
    "company_name": "Demo Construction",
    "company_logo_url": "",
    "company_address": "123 Main Street, Springfield, IL 62701",
    "company_email": "demo@invoicify.com",
    "company_phone": "(555) 123-4567",
    "email": "demo@invoicify.com"
  }
}
```

**cURL Test**:
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/validate-access \
  -H "Content-Type: application/json" \
  -d '{"access_code":"DEMO-2026"}'
```

---

### 2. Create Invoice

**Endpoint**: `POST /.netlify/functions/create-invoice`

**Request**: `multipart/form-data`
- `access_code` (required): Access code
- `file` (required): Image/PDF file
- `customer_name` (optional): Customer name
- `customer_email` (optional): Customer email
- `job_notes` (optional): Job notes

**Response**:
```json
{
  "ok": true,
  "invoice_id": "inv_1709600000000",
  "pdf_url": "data:text/html;base64,...",
  "invoice_html": "<html>...</html>",
  "extracted_json": {
    "line_items": [
      {
        "description": "Labor - 8 hours",
        "quantity": 8,
        "unit_price": 75,
        "amount": 600
      },
      {
        "description": "Materials",
        "quantity": 1,
        "unit_price": 550,
        "amount": 550
      }
    ],
    "subtotal": 1150,
    "tax": 0,
    "total": 1150,
    "notes": ""
  },
  "customer_name": "John Smith",
  "customer_email": "john@example.com",
  "total": 1150,
  "usage": {
    "count": 6,
    "limit": 50
  }
}
```

**cURL Test**:
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/create-invoice \
  -F "access_code=DEMO-2026" \
  -F "customer_name=John Smith" \
  -F "customer_email=john@example.com" \
  -F "job_notes=Deck repair work" \
  -F "file=@/path/to/receipt.jpg"
```

**JavaScript Example**:
```javascript
const formData = new FormData();
formData.append('access_code', 'DEMO-2026');
formData.append('file', fileInput.files[0]);
formData.append('customer_name', 'John Smith');
formData.append('customer_email', 'john@example.com');
formData.append('job_notes', 'Deck repair');

const response = await fetch('/.netlify/functions/create-invoice', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

---

### 3. Get Invoices

**Endpoint**: `GET /.netlify/functions/get-invoices?access_code=XXX&limit=25`

**Query Parameters**:
- `access_code` (required): Access code
- `limit` (optional): Max invoices to return (default: 25)

**Response**:
```json
{
  "ok": true,
  "invoices": [
    {
      "invoice_id": "inv_1709600000000",
      "access_code": "DEMO-2026",
      "created_at": "2026-03-05T12:00:00.000Z",
      "customer_name": "John Smith",
      "customer_email": "john@example.com",
      "job_notes": "Deck repair",
      "total": 1150,
      "pdf_url": "...",
      "invoice_html": "...",
      "extracted_json": {...}
    }
  ],
  "count": 1
}
```

**cURL Test**:
```bash
curl https://YOUR_SITE.netlify.app/.netlify/functions/get-invoices?access_code=DEMO-2026
```

---

### 4. Update Settings

**Endpoint**: `POST /.netlify/functions/update-settings`

**Request**:
```json
{
  "access_code": "DEMO-2026",
  "company_name": "New Company Name",
  "company_email": "new@email.com",
  "company_phone": "(555) 999-8888",
  "company_address": "456 New Street",
  "company_logo_url": "https://example.com/logo.png"
}
```

**Response**:
```json
{
  "ok": true,
  "message": "Settings updated successfully",
  "updated_fields": ["company_name", "company_email", "company_phone", "company_address", "company_logo_url"]
}
```

**cURL Test**:
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/update-settings \
  -H "Content-Type: application/json" \
  -d '{
    "access_code": "DEMO-2026",
    "company_name": "Updated Company",
    "company_email": "updated@example.com"
  }'
```

---

## 🔒 Security Features

### Built-in Security:
- ✅ CORS enabled (configured for your frontend domain)
- ✅ Rate limiting (10 requests/minute per access code)
- ✅ Input validation on all endpoints
- ✅ Environment variables for secrets (not exposed to frontend)
- ✅ Service account authentication for Google Sheets

### Recommended Additions:
- [ ] Add API key authentication
- [ ] Implement JWT tokens
- [ ] Add request signing
- [ ] Enable Netlify Identity
- [ ] Add IP whitelisting

---

## 📊 Database Schema

### Google Sheets: 1rJvNFRdOlMuYxbkoePWXmkE0yxxBnldB5Y6jTjSLu1Q

**Sheet1 (Users)**:
```
access_code | email | plan | billing_cycle_start | invoice_count_month | company_name | company_logo_url | company_address | company_email | company_phone
```

**Invoices**:
```
invoice_id | access_code | created_at | customer_name | customer_email | job_notes | total | pdf_url | invoice_html | extracted_json
```

---

## 🎯 Plan Limits

- **Starter**: 50 invoices/month - $69/month
- **Pro**: 200 invoices/month - $99/month
- **Autopilot**: Unlimited (999999) - $149/month

Limits are enforced automatically. Billing cycle resets every 30 days.

---

## 🧪 Testing

### Test Access Code
Use `DEMO-2026` for testing

### Local Testing
```bash
# Start dev server
npm run dev

# Test validate-access
curl -X POST http://localhost:8888/.netlify/functions/validate-access \
  -H "Content-Type: application/json" \
  -d '{"access_code":"DEMO-2026"}'

# Test with actual file
curl -X POST http://localhost:8888/.netlify/functions/create-invoice \
  -F "access_code=DEMO-2026" \
  -F "customer_name=Test Customer" \
  -F "file=@test-receipt.jpg"
```

---

## 🐛 Troubleshooting

### Issue: "GOOGLE_SERVICE_ACCOUNT_KEY not found"
**Solution**: Make sure environment variables are set in Netlify dashboard

### Issue: "Failed to lookup user"
**Solution**:
1. Verify Google Sheet is shared with service account email
2. Check spreadsheet ID is correct
3. Ensure service account has Editor permissions

### Issue: "OpenAI API error"
**Solution**:
1. Verify API key is valid
2. Check API credits/quota
3. Ensure you have access to GPT-4 Vision

### Issue: "Rate limit exceeded"
**Solution**: Wait 1 minute and try again, or implement Redis-based rate limiting

---

## 📝 Frontend Integration

### React Example

```javascript
import { useState } from 'react';

const API_URL = 'https://YOUR_SITE.netlify.app/.netlify/functions';

function CreateInvoice() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    formData.append('access_code', localStorage.getItem('access_code'));

    try {
      const response = await fetch(`${API_URL}/create-invoice`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.ok) {
        alert('Invoice created: ' + result.invoice_id);
        // Display invoice preview
        document.getElementById('preview').innerHTML = result.invoice_html;
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" name="file" required />
      <input type="text" name="customer_name" placeholder="Customer Name" />
      <input type="email" name="customer_email" placeholder="Email" />
      <textarea name="job_notes" placeholder="Job Notes"></textarea>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Invoice'}
      </button>
    </form>
  );
}
```

---

## 🚀 Production Checklist

Before going live:

- [ ] Set all environment variables in Netlify
- [ ] Share Google Sheet with service account
- [ ] Create Invoices sheet in Google Sheets
- [ ] Test all 4 endpoints
- [ ] Set up custom domain
- [ ] Enable HTTPS (automatic on Netlify)
- [ ] Configure CORS for your domain only
- [ ] Set up error monitoring (Sentry, LogRocket)
- [ ] Implement real PDF generation (Puppeteer Lambda or API)
- [ ] Add webhook for Stripe payments
- [ ] Set up backup for Google Sheets data

---

## 📞 Support

**Spreadsheet**: https://docs.google.com/spreadsheets/d/1rJvNFRdOlMuYxbkoePWXmkE0yxxBnldB5Y6jTjSLu1Q/edit

**Demo Access Code**: DEMO-2026

**Netlify Docs**: https://docs.netlify.com/functions/overview/

---

## 🎉 You're All Set!

Your Netlify Functions backend is ready to power your pretty Invoicify portal!

Deploy, test, and start generating invoices with AI. 🚀
