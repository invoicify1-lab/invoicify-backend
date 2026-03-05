/**
 * Invoice AI Extraction and Generation
 * Uses OpenAI GPT-4 Vision to extract invoice data from images
 */

async function extractInvoiceData(fileBuffer, fileName, jobNotes, customerName, customerEmail) {
  const fetch = require('node-fetch');

  // Convert buffer to base64
  const base64Image = fileBuffer.toString('base64');
  const mimeType = getMimeType(fileName);

  const prompt = `You are an invoice data extraction AI. Analyze this receipt/work photo and extract invoice line items.

Context:
- Customer: ${customerName || 'N/A'}
- Customer Email: ${customerEmail || 'N/A'}
- Job Notes: ${jobNotes || 'N/A'}

Extract and return ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "line_items": [
    {"description": "Labor - X hours", "quantity": X, "unit_price": X, "amount": X},
    {"description": "Materials/parts description", "quantity": X, "unit_price": X, "amount": X}
  ],
  "subtotal": X,
  "tax": X,
  "total": X,
  "notes": "any additional notes from the image"
}

Rules:
- Extract ALL visible line items, materials, labor
- Calculate accurate totals
- If no clear line items visible, estimate based on the work shown
- Return valid JSON only`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
    }

    const content = data.choices[0].message.content.trim();

    // Parse JSON response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse invoice data from AI');
    }

    return extractedData;
  } catch (error) {
    console.error('Error extracting invoice data:', error);
    throw error;
  }
}

/**
 * Generate invoice HTML
 */
function generateInvoiceHTML(invoiceData, companyProfile) {
  const date = new Date(invoiceData.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const lineItemsHTML = invoiceData.extracted_json.line_items
    .map(item => `
      <tr>
        <td>${item.description}</td>
        <td style="text-align: center;">${item.quantity || 1}</td>
        <td style="text-align: right;">$${(item.unit_price || item.amount).toFixed(2)}</td>
        <td style="text-align: right;"><strong>$${item.amount.toFixed(2)}</strong></td>
      </tr>
    `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceData.invoice_id}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 40px;
      background: #f5f5f5;
    }
    .invoice {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 60px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    .company-info h1 {
      margin: 0 0 10px 0;
      color: #2563eb;
      font-size: 28px;
    }
    .company-info p {
      margin: 4px 0;
      color: #666;
      line-height: 1.6;
    }
    .invoice-details {
      text-align: right;
    }
    .invoice-details h2 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 32px;
    }
    .invoice-details p {
      margin: 4px 0;
      color: #666;
    }
    .customer-info {
      margin-bottom: 40px;
    }
    .customer-info h3 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .customer-info p {
      margin: 4px 0;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead {
      background: #f8f9fa;
    }
    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #dee2e6;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e9ecef;
      color: #666;
    }
    .totals {
      margin-top: 30px;
      text-align: right;
    }
    .totals table {
      margin-left: auto;
      width: 300px;
    }
    .totals td {
      border: none;
      padding: 8px 12px;
    }
    .totals .total-row {
      font-size: 20px;
      font-weight: bold;
      color: #2563eb;
      border-top: 2px solid #2563eb;
    }
    .notes {
      margin-top: 40px;
      padding: 20px;
      background: #f8f9fa;
      border-left: 4px solid #2563eb;
    }
    .notes h4 {
      margin: 0 0 10px 0;
      color: #333;
    }
    .notes p {
      margin: 0;
      color: #666;
      line-height: 1.6;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-info">
        <h1>${companyProfile.company_name}</h1>
        <p>${companyProfile.company_address}</p>
        <p>${companyProfile.company_email}</p>
        <p>${companyProfile.company_phone}</p>
      </div>
      <div class="invoice-details">
        <h2>INVOICE</h2>
        <p><strong>Invoice #:</strong> ${invoiceData.invoice_id}</p>
        <p><strong>Date:</strong> ${date}</p>
      </div>
    </div>

    <div class="customer-info">
      <h3>Bill To:</h3>
      <p><strong>${invoiceData.customer_name || 'Customer'}</strong></p>
      ${invoiceData.customer_email ? `<p>${invoiceData.customer_email}</p>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Subtotal:</td>
          <td style="text-align: right;"><strong>$${invoiceData.extracted_json.subtotal.toFixed(2)}</strong></td>
        </tr>
        ${invoiceData.extracted_json.tax > 0 ? `
        <tr>
          <td>Tax:</td>
          <td style="text-align: right;"><strong>$${invoiceData.extracted_json.tax.toFixed(2)}</strong></td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td>TOTAL:</td>
          <td style="text-align: right;">$${invoiceData.total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    ${invoiceData.job_notes ? `
    <div class="notes">
      <h4>Notes</h4>
      <p>${invoiceData.job_notes}</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Generated by Invoicify - Professional Invoice Automation</p>
    </div>
  </div>
</body>
</html>
  `;

  return html.trim();
}

/**
 * Generate PDF from HTML (mock - in production use puppeteer or API)
 */
async function generatePDF(html, invoiceId) {
  // For MVP, we'll save HTML and provide a link
  // In production, use puppeteer, PDFKit, or a service like DocRaptor

  // Option 1: Use Netlify Blobs to store HTML (requires @netlify/blobs)
  // Option 2: Upload to S3 and return URL
  // Option 3: Use a PDF generation API

  // For now, return a data URL
  const htmlBase64 = Buffer.from(html).toString('base64');
  return `data:text/html;base64,${htmlBase64}`;

  // TODO: Implement real PDF generation
  // Recommended: Use Puppeteer in a separate Lambda function
  // Or use a PDF API service like PDFShift, DocRaptor, etc.
}

function getMimeType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'heic': 'image/heic'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

module.exports = {
  extractInvoiceData,
  generateInvoiceHTML,
  generatePDF
};
