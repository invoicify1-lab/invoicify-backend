const { getUserInvoices } = require('./utils/google-sheets');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const { access_code, limit } = params;

    if (!access_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'access_code is required' })
      };
    }

    // Get invoices for the user
    const invoices = await getUserInvoices(
      access_code.toUpperCase(),
      parseInt(limit) || 25
    );

    // Return success even if no invoices found (empty array)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        invoices: invoices,
        count: invoices.length
      })
    };
  } catch (error) {
    console.error('Error in get-invoices:', error);

    // Handle specific error cases
    if (error.message.includes('Invalid sheet range')) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: 'Invoices sheet not found. Please create the Invoices sheet in your Google Spreadsheet.'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
