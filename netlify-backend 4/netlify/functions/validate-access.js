const { lookupUser, checkBillingCycle, PLAN_LIMITS } = require('./utils/google-sheets');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
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
    const { access_code } = JSON.parse(event.body);

    if (!access_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'access_code is required' })
      };
    }

    // Look up user
    let user = await lookupUser(access_code.toUpperCase());

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ ok: false, error: 'Invalid access code' })
      };
    }

    // Check and reset billing cycle if needed
    user = await checkBillingCycle(user);

    const limit = PLAN_LIMITS[user.plan] || PLAN_LIMITS.starter;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        plan: user.plan,
        usage: user.invoice_count_month,
        limit: limit,
        company_profile: {
          company_name: user.company_name,
          company_logo_url: user.company_logo_url,
          company_address: user.company_address,
          company_email: user.company_email,
          company_phone: user.company_phone,
          email: user.email
        }
      })
    };
  } catch (error) {
    console.error('Error in validate-access:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
