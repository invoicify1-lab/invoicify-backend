const busboy = require('busboy');
const { lookupUser, checkBillingCycle, canCreateInvoice, saveInvoice, updateUser } = require('./utils/google-sheets');
const { extractInvoiceData, generateInvoiceHTML, generatePDF } = require('./utils/invoice-generator');

// Rate limiting (simple in-memory, use Redis for production)
const rateLimits = new Map();

function checkRateLimit(accessCode) {
  const now = Date.now();
  const key = accessCode;
  const limit = rateLimits.get(key) || { count: 0, resetAt: now + 60000 };

  if (now > limit.resetAt) {
    limit.count = 0;
    limit.resetAt = now + 60000;
  }

  limit.count++;
  rateLimits.set(key, limit);

  return limit.count <= 10; // Max 10 requests per minute
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse multipart form data
    const formData = await parseMultipartForm(event);

    const {
      access_code,
      job_notes,
      customer_name,
      customer_email,
      file
    } = formData;

    if (!access_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'access_code is required' })
      };
    }

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'file is required' })
      };
    }

    // Rate limiting
    if (!checkRateLimit(access_code)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ ok: false, error: 'Rate limit exceeded. Please try again later.' })
      };
    }

    // A) Validate access_code
    let user = await lookupUser(access_code.toUpperCase());

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ ok: false, error: 'Invalid access code' })
      };
    }

    // B) Reset billing cycle if needed
    user = await checkBillingCycle(user);

    // C) Enforce plan limits
    if (!canCreateInvoice(user)) {
      const limit = user.plan === 'starter' ? 50 : user.plan === 'pro' ? 200 : 999999;
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          ok: false,
          error: `You've reached your monthly limit of ${limit} invoices. Please upgrade your plan.`,
          limit_reached: true,
          current_plan: user.plan
        })
      };
    }

    // D) Company profile from saved settings (NOT from image)
    const companyProfile = {
      company_name: user.company_name,
      company_logo_url: user.company_logo_url,
      company_address: user.company_address,
      company_email: user.company_email,
      company_phone: user.company_phone
    };

    // E) Extract invoice data from file using AI
    console.log('Extracting invoice data from file...');
    const extractedData = await extractInvoiceData(
      file.data,
      file.filename,
      job_notes,
      customer_name,
      customer_email
    );

    // F) Generate invoice HTML
    const invoiceId = `inv_${Date.now()}`;
    const createdAt = new Date().toISOString();

    const invoiceData = {
      invoice_id: invoiceId,
      access_code: user.access_code,
      created_at: createdAt,
      customer_name: customer_name || 'Customer',
      customer_email: customer_email || '',
      job_notes: job_notes || '',
      total: extractedData.total,
      extracted_json: extractedData
    };

    const invoiceHTML = generateInvoiceHTML(invoiceData, companyProfile);

    // G) Generate PDF
    const pdfUrl = await generatePDF(invoiceHTML, invoiceId);

    invoiceData.invoice_html = invoiceHTML;
    invoiceData.pdf_url = pdfUrl;

    // H) Save invoice to Google Sheets BEFORE any other action
    await saveInvoice(invoiceData);

    // I) Increment invoice count
    await updateUser(user.access_code, {
      invoice_count_month: user.invoice_count_month + 1
    });

    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        invoice_id: invoiceId,
        pdf_url: pdfUrl,
        invoice_html: invoiceHTML,
        extracted_json: extractedData,
        customer_name: invoiceData.customer_name,
        customer_email: invoiceData.customer_email,
        total: invoiceData.total,
        usage: {
          count: user.invoice_count_month + 1,
          limit: user.plan === 'starter' ? 50 : user.plan === 'pro' ? 200 : 999999
        }
      })
    };
  } catch (error) {
    console.error('Error in create-invoice:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};

// Parse multipart form data
function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: {
        'content-type': event.headers['content-type'] || event.headers['Content-Type']
      }
    });

    const formData = {};
    const files = [];

    bb.on('file', (fieldname, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        files.push({
          fieldname,
          filename,
          encoding,
          mimeType,
          data: Buffer.concat(chunks)
        });
      });
    });

    bb.on('field', (fieldname, value) => {
      formData[fieldname] = value;
    });

    bb.on('finish', () => {
      if (files.length > 0) {
        formData.file = files[0];
      }
      resolve(formData);
    });

    bb.on('error', (error) => {
      reject(error);
    });

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body;

    bb.write(body);
    bb.end();
  });
}
