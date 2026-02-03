/**
 * SumUp Payment Service
 * Handles SumUp API integration for card payments
 */

const https = require('https');
const db = require('../db');
const logger = require('../utils/logger');

// SumUp API Base URL
const SUMUP_API_URL = 'api.sumup.com';

/**
 * Promisified DB Query
 */
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * Get SumUp configuration for a Dojo
 */
const getSumUpConfig = async (dojoId) => {
  const results = await queryAsync(
    'SELECT sumup_api_key, sumup_merchant_code, sumup_client_id, sumup_client_secret, sumup_aktiv FROM dojo WHERE id = ?',
    [dojoId]
  );

  if (results.length === 0) {
    throw new Error('Dojo not found');
  }

  const config = results[0];

  if (!config.sumup_aktiv) {
    throw new Error('SumUp ist für dieses Dojo nicht aktiviert');
  }

  if (!config.sumup_api_key) {
    throw new Error('SumUp API Key nicht konfiguriert');
  }

  return config;
};

/**
 * Make HTTP request to SumUp API
 */
const sumupRequest = (method, path, apiKey, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUMUP_API_URL,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({
              status: res.statusCode,
              message: parsed.message || parsed.error_message || 'SumUp API Error',
              data: parsed
            });
          }
        } catch (e) {
          reject({ status: res.statusCode, message: 'Invalid JSON response', raw: responseData });
        }
      });
    });

    req.on('error', (err) => {
      reject({ status: 0, message: err.message });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
};

/**
 * Create a new SumUp Checkout
 * @param {number} dojoId - Dojo ID
 * @param {number} amount - Amount in EUR
 * @param {string} description - Payment description
 * @param {string} reference - Unique reference for this payment
 * @param {object} options - Additional options (mitglied_id, rechnung_id, etc.)
 */
const createCheckout = async (dojoId, amount, description, reference, options = {}) => {
  const config = await getSumUpConfig(dojoId);

  // Get merchant email (pay_to_email is required)
  const dojoData = await queryAsync('SELECT email FROM dojo WHERE id = ?', [dojoId]);
  const merchantEmail = dojoData[0]?.email;

  if (!merchantEmail) {
    throw new Error('Dojo E-Mail nicht konfiguriert');
  }

  const checkoutData = {
    checkout_reference: reference,
    amount: parseFloat(amount.toFixed(2)),
    currency: 'EUR',
    pay_to_email: merchantEmail,
    description: description.substring(0, 255), // Max 255 chars
    merchant_code: config.sumup_merchant_code,
  };

  // Optional: Return URL for redirect after payment
  if (options.return_url) {
    checkoutData.return_url = options.return_url;
  }

  logger.info('Creating SumUp checkout:', { dojoId, amount, reference });

  const response = await sumupRequest('POST', '/v0.1/checkouts', config.sumup_api_key, checkoutData);

  // Save to database
  await queryAsync(
    `INSERT INTO sumup_payments
     (checkout_id, checkout_reference, dojo_id, amount, currency, description, status, checkout_url, zahlungstyp, mitglied_id, rechnung_id, verkauf_id, event_anmeldung_id, verbandsmitgliedschaft_id, response_data)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      response.id,
      reference,
      dojoId,
      amount,
      'EUR',
      description,
      response.checkout_url || `https://pay.sumup.com/${response.id}`,
      options.zahlungstyp || 'sonstig',
      options.mitglied_id || null,
      options.rechnung_id || null,
      options.verkauf_id || null,
      options.event_anmeldung_id || null,
      options.verbandsmitgliedschaft_id || null,
      JSON.stringify(response)
    ]
  );

  logger.info('SumUp checkout created:', { checkoutId: response.id, checkoutUrl: response.checkout_url });

  return {
    checkout_id: response.id,
    checkout_reference: reference,
    amount: response.amount,
    status: response.status,
    checkout_url: response.checkout_url || `https://pay.sumup.com/${response.id}`,
  };
};

/**
 * Get checkout status from SumUp
 * @param {string} checkoutId - SumUp Checkout ID
 * @param {number} dojoId - Dojo ID (for API key)
 */
const getCheckoutStatus = async (checkoutId, dojoId) => {
  const config = await getSumUpConfig(dojoId);

  const response = await sumupRequest('GET', `/v0.1/checkouts/${checkoutId}`, config.sumup_api_key);

  // Update local database
  const updateData = {
    status: response.status,
    transaction_id: response.transaction_id || null,
    transaction_code: response.transaction_code || null,
  };

  if (response.status === 'PAID') {
    updateData.paid_at = new Date();

    // Get receipt URL if available
    if (response.transactions && response.transactions.length > 0) {
      const txn = response.transactions[0];
      updateData.receipt_url = txn.receipt_url || null;
      updateData.transaction_id = txn.id;
      updateData.transaction_code = txn.transaction_code;
    }
  }

  await queryAsync(
    `UPDATE sumup_payments
     SET status = ?, transaction_id = ?, transaction_code = ?, paid_at = ?, receipt_url = ?, response_data = ?, updated_at = NOW()
     WHERE checkout_id = ?`,
    [
      updateData.status,
      updateData.transaction_id,
      updateData.transaction_code,
      updateData.paid_at || null,
      updateData.receipt_url || null,
      JSON.stringify(response),
      checkoutId
    ]
  );

  logger.info('SumUp checkout status updated:', { checkoutId, status: response.status });

  return {
    checkout_id: checkoutId,
    status: response.status,
    amount: response.amount,
    transaction_id: updateData.transaction_id,
    transaction_code: updateData.transaction_code,
    receipt_url: updateData.receipt_url,
    paid: response.status === 'PAID',
  };
};

/**
 * Process SumUp Webhook
 * @param {object} payload - Webhook payload from SumUp
 */
const processWebhook = async (payload) => {
  logger.info('Processing SumUp webhook:', payload);

  const { id: checkoutId, status, transaction_id, transaction_code } = payload;

  if (!checkoutId) {
    throw new Error('Missing checkout_id in webhook payload');
  }

  // Get payment record
  const payments = await queryAsync('SELECT * FROM sumup_payments WHERE checkout_id = ?', [checkoutId]);

  if (payments.length === 0) {
    logger.warn('Webhook for unknown checkout:', checkoutId);
    return { success: false, message: 'Unknown checkout' };
  }

  const payment = payments[0];

  // Update status
  const updateData = {
    status: status,
    transaction_id: transaction_id || null,
    transaction_code: transaction_code || null,
    paid_at: status === 'PAID' ? new Date() : null,
  };

  await queryAsync(
    `UPDATE sumup_payments
     SET status = ?, transaction_id = ?, transaction_code = ?, paid_at = ?, response_data = ?, updated_at = NOW()
     WHERE checkout_id = ?`,
    [
      updateData.status,
      updateData.transaction_id,
      updateData.transaction_code,
      updateData.paid_at,
      JSON.stringify(payload),
      checkoutId
    ]
  );

  // Handle successful payment
  if (status === 'PAID') {
    await handleSuccessfulPayment(payment, updateData);
  }

  return { success: true, status: status };
};

/**
 * Handle successful payment - update related records
 */
const handleSuccessfulPayment = async (payment, transactionData) => {
  logger.info('Handling successful SumUp payment:', { paymentId: payment.id, type: payment.zahlungstyp });

  switch (payment.zahlungstyp) {
    case 'verkauf':
      if (payment.verkauf_id) {
        await queryAsync(
          `UPDATE verkaeufe SET
           zahlungsmethode = 'sumup',
           sumup_checkout_id = ?,
           sumup_transaction_id = ?,
           bezahlt = 1,
           bezahlt_am = NOW()
           WHERE verkauf_id = ?`,
          [payment.checkout_id, transactionData.transaction_id, payment.verkauf_id]
        );
      }
      break;

    case 'rechnung':
      if (payment.rechnung_id) {
        await queryAsync(
          `UPDATE rechnungen SET
           status = 'bezahlt',
           zahlungsart = 'sumup',
           bezahlt_am = NOW()
           WHERE id = ?`,
          [payment.rechnung_id]
        );
      }
      break;

    case 'mitgliedsbeitrag':
      // Handle membership payment if needed
      break;

    case 'event':
      if (payment.event_anmeldung_id) {
        await queryAsync(
          `UPDATE event_anmeldungen SET
           zahlungsstatus = 'bezahlt',
           zahlungsart = 'sumup',
           bezahlt_am = NOW()
           WHERE id = ?`,
          [payment.event_anmeldung_id]
        );
      }
      break;

    case 'verbandsbeitrag':
      if (payment.verbandsmitgliedschaft_id) {
        await queryAsync(
          `UPDATE verbandsmitgliedschaft_zahlungen SET
           status = 'bezahlt',
           zahlungsart = 'sumup',
           bezahlt_am = NOW()
           WHERE verbandsmitgliedschaft_id = ? AND status = 'offen'
           ORDER BY created_at DESC LIMIT 1`,
          [payment.verbandsmitgliedschaft_id]
        );
      }
      break;
  }
};

/**
 * Test SumUp API connection
 * @param {number} dojoId - Dojo ID
 */
const testConnection = async (dojoId) => {
  try {
    const config = await getSumUpConfig(dojoId);

    // Try to get merchant profile
    const response = await sumupRequest('GET', '/v0.1/me', config.sumup_api_key);

    return {
      success: true,
      merchant_code: response.merchant_profile?.merchant_code,
      business_name: response.merchant_profile?.business_name,
      email: response.email,
    };
  } catch (error) {
    logger.error('SumUp connection test failed:', error);
    return {
      success: false,
      error: error.message || 'Verbindung fehlgeschlagen',
    };
  }
};

/**
 * Get payment by checkout ID
 */
const getPaymentByCheckoutId = async (checkoutId) => {
  const results = await queryAsync('SELECT * FROM sumup_payments WHERE checkout_id = ?', [checkoutId]);
  return results[0] || null;
};

/**
 * Get payments for a Dojo
 */
const getPaymentsForDojo = async (dojoId, limit = 50, offset = 0) => {
  const results = await queryAsync(
    `SELECT * FROM sumup_payments WHERE dojo_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [dojoId, limit, offset]
  );
  return results;
};

/**
 * Check if SumUp is configured for a Dojo
 */
const isConfigured = async (dojoId) => {
  try {
    const results = await queryAsync(
      'SELECT sumup_api_key, sumup_aktiv FROM dojo WHERE id = ?',
      [dojoId]
    );
    return results[0]?.sumup_aktiv === 1 && !!results[0]?.sumup_api_key;
  } catch {
    return false;
  }
};

module.exports = {
  createCheckout,
  getCheckoutStatus,
  processWebhook,
  testConnection,
  getPaymentByCheckoutId,
  getPaymentsForDojo,
  isConfigured,
  getSumUpConfig,
};
