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

    const invoices = await getUserInvoices(
      access_code.toUpperCase(),
      parseInt(limit) || 25
    );

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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
