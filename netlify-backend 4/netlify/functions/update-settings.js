const { lookupUser, updateUser } = require('./utils/google-sheets');

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
    const body = JSON.parse(event.body);
    const {
      access_code,
      company_name,
      company_logo_url,
      company_address,
      company_email,
      company_phone
    } = body;

    if (!access_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'access_code is required' })
      };
    }

    // Verify user exists
    const user = await lookupUser(access_code.toUpperCase());

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ ok: false, error: 'Invalid access code' })
      };
    }

    // Build updates object (only include provided fields)
    const updates = {};
    if (company_name !== undefined) updates.company_name = company_name;
    if (company_logo_url !== undefined) updates.company_logo_url = company_logo_url;
    if (company_address !== undefined) updates.company_address = company_address;
    if (company_email !== undefined) updates.company_email = company_email;
    if (company_phone !== undefined) updates.company_phone = company_phone;

    // Update user
    await updateUser(access_code.toUpperCase(), updates);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: 'Settings updated successfully',
        updated_fields: Object.keys(updates)
      })
    };
  } catch (error) {
    console.error('Error in update-settings:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
