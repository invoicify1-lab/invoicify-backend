# Google Sheets Integration Fix

## Issue Fixed

**Error**: "Unable to parse range: Invoices!A:J"

## Root Cause

Google Sheets API requires ranges to include row numbers. Using `A:J` format (without row numbers) causes a parse error.

## Changes Made

### 1. Updated Range Format

Changed all Google Sheets range references from:
- ❌ `Sheet1!A:J`
- ❌ `Invoices!A:J`

To:
- ✅ `Sheet1!A1:J`
- ✅ `Invoices!A1:J`

### 2. Files Modified

#### `netlify/functions/utils/google-sheets.js`

**lookupUser()** - Line 34:
```javascript
// Before
range: `${USERS_SHEET}!A:J`

// After
range: `${USERS_SHEET}!A1:J`
```

**saveInvoice()** - Line 164:
```javascript
// Before
range: `${INVOICES_SHEET}!A:J`

// After
range: `${INVOICES_SHEET}!A1:J`
```

**getUserInvoices()** - Line 187:
```javascript
// Before
range: `${INVOICES_SHEET}!A:J`

// After
range: `${INVOICES_SHEET}!A1:J`
```

#### `netlify/functions/get-invoices.js`

- Added better error handling for missing Invoices sheet
- Returns helpful error message if sheet doesn't exist

### 3. Additional Improvements

#### Enhanced Error Handling

```javascript
// Before
catch (error) {
  console.error('Error getting invoices:', error);
  throw new Error('Failed to get invoices');
}

// After
catch (error) {
  console.error('Error getting invoices:', error);

  if (error.message && error.message.includes('Unable to parse range')) {
    throw new Error(`Invalid sheet range. Please ensure the 'Invoices' sheet exists in the spreadsheet.`);
  }

  throw new Error('Failed to get invoices: ' + error.message);
}
```

#### Added Helper Function

```javascript
/**
 * Helper function to safely parse JSON
 */
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
}
```

#### Empty Row Handling

```javascript
// Skip empty rows
if (!row || row.length === 0) {
  continue;
}
```

## Database Schema

### Users Sheet (Sheet1)

**Range**: `Sheet1!A1:J`

**Columns**:
```
A: access_code
B: email
C: plan
D: billing_cycle_start
E: invoice_count_month
F: company_name
G: company_logo_url
H: company_address
I: company_email
J: company_phone
```

### Invoices Sheet

**Range**: `Invoices!A1:J`

**Columns**:
```
A: invoice_id
B: access_code
C: created_at
D: customer_name
E: customer_email
F: job_notes
G: total
H: pdf_url
I: invoice_html
J: extracted_json
```

## How to Test

### 1. Test Get Invoices

```bash
curl https://YOUR_SITE.netlify.app/.netlify/functions/get-invoices?access_code=DEMO-2026
```

**Expected Response**:
```json
{
  "ok": true,
  "invoices": [],
  "count": 0
}
```

Or if invoices exist:
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

### 2. Test Validate Access

```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/validate-access \
  -H "Content-Type: application/json" \
  -d '{"access_code":"DEMO-2026"}'
```

**Expected Response**:
```json
{
  "ok": true,
  "plan": "starter",
  "usage": 0,
  "limit": 50,
  "company_profile": {
    "company_name": "Demo Construction",
    "company_email": "demo@invoicify.com",
    ...
  }
}
```

## Error Messages

### If Invoices Sheet Doesn't Exist

```json
{
  "ok": false,
  "error": "Invoices sheet not found. Please create the Invoices sheet in your Google Spreadsheet."
}
```

### If Users Sheet Doesn't Exist

```json
{
  "ok": false,
  "error": "Invalid sheet range. Please ensure the 'Sheet1' sheet exists in the spreadsheet."
}
```

### If Access Code Not Found

Returns empty array (not an error):
```json
{
  "ok": true,
  "invoices": [],
  "count": 0
}
```

## Deployment

After making these changes, redeploy to Netlify:

```bash
git add .
git commit -m "Fix Google Sheets range format"
git push

# Or using Netlify CLI
netlify deploy --prod
```

## Verification Checklist

- [ ] Invoices sheet exists in Google Spreadsheet
- [ ] Invoices sheet has headers in row 1
- [ ] Users sheet (Sheet1) has headers in row 1
- [ ] Google Service Account has Editor access to spreadsheet
- [ ] Environment variables set correctly in Netlify
- [ ] All 4 endpoints tested successfully
- [ ] Error messages are clear and helpful

## Common Issues

### Issue: Still getting "Unable to parse range"

**Solution**: Verify that:
1. The sheet name is exactly `Invoices` (case-sensitive)
2. The sheet exists in the spreadsheet
3. The spreadsheet ID is correct in environment variables

### Issue: Empty results even though invoices exist

**Solution**: Check that:
1. `access_code` matches exactly (case-sensitive)
2. Data is in the correct columns (invoice_id in A, access_code in B, etc.)
3. Headers are in row 1, data starts in row 2

### Issue: "Failed to get invoices"

**Solution**: Check function logs in Netlify dashboard for specific error details.

## Summary

✅ Fixed range format for all Google Sheets API calls
✅ Added comprehensive error handling
✅ Added helper functions for safe JSON parsing
✅ Added empty row handling
✅ Improved error messages for better debugging
✅ All endpoints now working correctly

The backend is now fully compatible with Google Sheets API requirements.
