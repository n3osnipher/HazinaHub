import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

export const mpesaConfig = {
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  passkey: process.env.MPESA_PASSKEY || '',
  shortcode: process.env.MPESA_SHORTCODE || '174379',
  env: (process.env.MPESA_ENV || 'sandbox') as 'sandbox' | 'production',
  callbackUrl: process.env.MPESA_CALLBACK_URL || '',
  c2bConfirmationUrl: process.env.MPESA_C2B_CONFIRMATION_URL || '',
  c2bValidationUrl: process.env.MPESA_C2B_VALIDATION_URL || '',

  get baseUrl() {
    return this.env === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  },

  get oauthUrl() {
    return `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
  },

  get stkPushUrl() {
    return `${this.baseUrl}/mpesa/stkpush/v1/processrequest`;
  },

  get c2bRegisterUrl() {
    return `${this.baseUrl}/mpesa/c2b/v1/registerurl`;
  },

  get transactionStatusUrl() {
    return `${this.baseUrl}/mpesa/transactionstatus/v1/query`;
  },

  get accountBalanceUrl() {
    return `${this.baseUrl}/mpesa/accountbalance/v1/query`;
  },
  
  get b2cUrl() {
    return `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`;
  },
};
