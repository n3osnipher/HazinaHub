import axios from 'axios';
import { mpesaConfig } from '../config/mpesa';

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get M-Pesa OAuth token (with caching)
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const auth = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');
  
  try {
    const response = await axios.get(mpesaConfig.oauthUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    cachedToken = {
      token: response.data.access_token,
      expiresAt: Date.now() + (parseInt(response.data.expires_in) - 60) * 1000,
    };

    return cachedToken.token;
  } catch (error: any) {
    console.error('🚨 Daraja Auth Failed!');
    console.error('URL:', mpesaConfig.oauthUrl);
    console.error('Key length:', mpesaConfig.consumerKey?.length || 0);
    console.error('Secret length:', mpesaConfig.consumerSecret?.length || 0);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

/**
 * Generate M-Pesa password for STK push
 */
function generatePassword(): { password: string; timestamp: string } {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
  const password = Buffer.from(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}

/**
 * Initiate STK Push (Lipa Na M-Pesa Online)
 */
export async function initiateSTKPush(params: {
  phone: string;
  amount: number;
  accountReference: string;
  description: string;
}): Promise<{
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}> {
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();

  const response = await axios.post(
    mpesaConfig.stkPushUrl,
    {
      BusinessShortCode: mpesaConfig.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(params.amount),
      PartyA: params.phone,
      PartyB: mpesaConfig.shortcode,
      PhoneNumber: params.phone,
      CallBackURL: mpesaConfig.callbackUrl,
      AccountReference: params.accountReference,
      TransactionDesc: params.description,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Register C2B URLs
 */
export async function registerC2BUrls(): Promise<void> {
  const token = await getAccessToken();

  await axios.post(
    mpesaConfig.c2bRegisterUrl,
    {
      ShortCode: mpesaConfig.shortcode,
      ResponseType: 'Completed',
      ConfirmationURL: mpesaConfig.c2bConfirmationUrl,
      ValidationURL: mpesaConfig.c2bValidationUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('✅ C2B URLs registered successfully');
}

/**
 * Query transaction status
 */
export async function queryTransactionStatus(transactionId: string): Promise<unknown> {
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();

  const response = await axios.post(
    mpesaConfig.transactionStatusUrl,
    {
      Initiator: 'apiuser',
      SecurityCredential: password,
      CommandID: 'TransactionStatusQuery',
      TransactionID: transactionId,
      PartyA: mpesaConfig.shortcode,
      IdentifierType: '4',
      ResultURL: mpesaConfig.callbackUrl, // Or create a specific status callback route
      QueueTimeOutURL: mpesaConfig.callbackUrl,
      Remarks: 'Transaction status query',
      Occasion: timestamp,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Check Account Balance
 * Initiates a request to M-Pesa to check the business shortcode balance.
 * Requires a ResultURL webhook to receive the actual balance data.
 */
export async function checkAccountBalance(): Promise<unknown> {
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();

  // The Account Balance API requires the initiator name and security credential
  const response = await axios.post(
    mpesaConfig.accountBalanceUrl,
    {
      Initiator: 'apiuser', // Replace with actual initiator if moving to prod
      SecurityCredential: password,
      CommandID: 'AccountBalance',
      PartyA: mpesaConfig.shortcode,
      IdentifierType: '4', // 4 for Organization shortcode
      Remarks: 'Periodic balance check',
      QueueTimeOutURL: mpesaConfig.callbackUrl.replace('/stk/callback', '/balance/timeout'),
      ResultURL: mpesaConfig.callbackUrl.replace('/stk/callback', '/balance/result'),
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Initiate B2C (Business to Customer) payment
 * Pays out funds from the organization shortcode to a customer's phone.
 */
export async function initiateB2C(params: {
  phone: string;
  amount: number;
  remarks: string;
  commandID?: 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';
}): Promise<any> {
  const token = await getAccessToken();
  const { password } = generatePassword();

  const response = await axios.post(
    mpesaConfig.b2cUrl,
    {
      InitiatorName: 'apiuser',
      SecurityCredential: password,
      CommandID: params.commandID || 'BusinessPayment',
      Amount: Math.ceil(params.amount),
      PartyA: mpesaConfig.shortcode,
      PartyB: params.phone,
      Remarks: params.remarks,
      QueueTimeOutURL: mpesaConfig.callbackUrl.replace('/stk/callback', '/b2c/timeout'),
      ResultURL: mpesaConfig.callbackUrl.replace('/stk/callback', '/b2c/result'),
      Occasion: 'MMF Withdrawal',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}
