const { google } = require('googleapis');

const SPREADSHEET_ID = '1rJvNFRdOlMuYxbkoePWXmkE0yxxBnldB5Y6jTjSLu1Q';
const USERS_SHEET = 'Sheet1';
const INVOICES_SHEET = 'Invoices';

const PLAN_LIMITS = {
  starter: 50,
  pro: 200,
  autopilot: 999999
};

// Initialize Google Sheets API
function getGoogleSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Look up user by access code
 */
async function lookupUser(accessCode) {
  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A1:J`
    });

    const rows = response.data.values || [];

    // Check if we have data
    if (rows.length === 0) {
      return null;
    }

    // Find user row (skip header row 0, access_code is in column A)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row || row.length === 0) {
        continue;
      }

      if (row[0] === accessCode) {
        return {
          access_code: row[0],
          email: row[1] || '',
          plan: row[2] || 'starter',
          billing_cycle_start: row[3] || new Date().toISOString().split('T')[0],
          invoice_count_month: parseInt(row[4]) || 0,
          company_name: row[5] || '',
          company_logo_url: row[6] || '',
          company_address: row[7] || '',
          company_email: row[8] || '',
          company_phone: row[9] || '',
          row_index: i + 1 // 1-based for Google Sheets
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error looking up user:', error);

    // Provide more specific error messages
    if (error.message && error.message.includes('Unable to parse range')) {
      throw new Error(`Invalid sheet range. Please ensure the '${USERS_SHEET}' sheet exists in the spreadsheet.`);
    }

    throw new Error('Failed to lookup user: ' + error.message);
  }
}

/**
 * Update user row
 */
async function updateUser(accessCode, updates) {
  const sheets = getGoogleSheetsClient();

  // Get current user data
  const user = await lookupUser(accessCode);
  if (!user) {
    throw new Error('User not found');
  }

  // Build updated row
  const updatedRow = [
    user.access_code,
    updates.email !== undefined ? updates.email : user.email,
    updates.plan !== undefined ? updates.plan : user.plan,
    updates.billing_cycle_start !== undefined ? updates.billing_cycle_start : user.billing_cycle_start,
    updates.invoice_count_month !== undefined ? updates.invoice_count_month.toString() : user.invoice_count_month.toString(),
    updates.company_name !== undefined ? updates.company_name : user.company_name,
    updates.company_logo_url !== undefined ? updates.company_logo_url : user.company_logo_url,
    updates.company_address !== undefined ? updates.company_address : user.company_address,
    updates.company_email !== undefined ? updates.company_email : user.company_email,
    updates.company_phone !== undefined ? updates.company_phone : user.company_phone
  ];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A${user.row_index}:J${user.row_index}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [updatedRow]
      }
    });

    return true;
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user');
  }
}

/**
 * Check and reset billing cycle if needed
 */
async function checkBillingCycle(user) {
  const cycleStart = new Date(user.billing_cycle_start);
  const now = new Date();
  const daysSince = (now - cycleStart) / (1000 * 60 * 60 * 24);

  if (daysSince > 30) {
    // Reset billing cycle
    await updateUser(user.access_code, {
      invoice_count_month: 0,
      billing_cycle_start: now.toISOString().split('T')[0]
    });

    return {
      ...user,
      invoice_count_month: 0,
      billing_cycle_start: now.toISOString().split('T')[0]
    };
  }

  return user;
}

/**
 * Check if user can create invoice (within plan limits)
 */
function canCreateInvoice(user) {
  const limit = PLAN_LIMITS[user.plan] || PLAN_LIMITS.starter;
  return user.invoice_count_month < limit;
}

/**
 * Save invoice to Google Sheets
 */
async function saveInvoice(invoiceData) {
  const sheets = getGoogleSheetsClient();

  const row = [
    invoiceData.invoice_id,
    invoiceData.access_code,
    invoiceData.created_at,
    invoiceData.customer_name || '',
    invoiceData.customer_email || '',
    invoiceData.job_notes || '',
    invoiceData.total.toString(),
    invoiceData.pdf_url || '',
    invoiceData.invoice_html || '',
    JSON.stringify(invoiceData.extracted_json || {})
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INVOICES_SHEET}!A1:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row]
      }
    });

    return invoiceData.invoice_id;
  } catch (error) {
    console.error('Error saving invoice:', error);

    // Provide more specific error message
    if (error.message && error.message.includes('Unable to parse range')) {
      throw new Error(`Invalid sheet range. Please ensure the 'Invoices' sheet exists in the spreadsheet with headers in row 1.`);
    }

    throw new Error('Failed to save invoice: ' + error.message);
  }
}

/**
 * Get invoices for user
 */
async function getUserInvoices(accessCode, limit = 25) {
  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INVOICES_SHEET}!A1:J`
    });

    const rows = response.data.values || [];

    // Check if we have data
    if (rows.length === 0) {
      return [];
    }

    const invoices = [];

    // Skip header row (row 0), filter by access_code (column B, index 1)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row || row.length === 0) {
        continue;
      }

      // Filter by access_code (column B)
      if (row[1] === accessCode) {
        invoices.push({
          invoice_id: row[0] || '',
          access_code: row[1] || '',
          created_at: row[2] || '',
          customer_name: row[3] || '',
          customer_email: row[4] || '',
          job_notes: row[5] || '',
          total: parseFloat(row[6]) || 0,
          pdf_url: row[7] || '',
          invoice_html: row[8] || '',
          extracted_json: row[9] ? tryParseJSON(row[9]) : {}
        });
      }
    }

    // Sort by created_at descending and limit
    return invoices
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting invoices:', error);

    // Provide more specific error messages
    if (error.message && error.message.includes('Unable to parse range')) {
      throw new Error(`Invalid sheet range. Please ensure the 'Invoices' sheet exists in the spreadsheet.`);
    }

    throw new Error('Failed to get invoices: ' + error.message);
  }
}

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

module.exports = {
  lookupUser,
  updateUser,
  checkBillingCycle,
  canCreateInvoice,
  saveInvoice,
  getUserInvoices,
  PLAN_LIMITS
};
