import axios from 'axios';

const AT_API_KEY = process.env.AT_API_KEY || '';
const AT_USERNAME = process.env.AT_USERNAME || 'sandbox';
const AT_SENDER_ID = process.env.AT_SENDER_ID || 'HazinaHub';

const baseUrl = AT_USERNAME === 'sandbox'
  ? 'https://api.sandbox.africastalking.com/version1/messaging'
  : 'https://api.africastalking.com/version1/messaging';

/**
 * Send SMS notification via Africa's Talking
 */
export async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    const response = await axios.post(
      baseUrl,
      new URLSearchParams({
        username: AT_USERNAME,
        to: phone,
        message: `[HazinaHub] ${message}`,
        from: AT_SENDER_ID,
      }).toString(),
      {
        headers: {
          apiKey: AT_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }
    );

    const recipients = response.data?.SMSMessageData?.Recipients;
    return recipients && recipients.length > 0 && recipients[0].status === 'Success';
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

/**
 * Send transaction notification
 */
export async function notifyTransaction(phone: string, amount: number, type: string): Promise<void> {
  const message = type === 'c2b'
    ? `Payment of KES ${amount.toLocaleString()} received successfully. Thank you for using HazinaHub.`
    : `Investment of KES ${amount.toLocaleString()} initiated via STK Push. Check your phone to complete.`;
  await sendSMS(phone, message);
}

/**
 * Send investment maturity notification
 */
export async function notifyMaturity(phone: string, fundName: string, amount: number): Promise<void> {
  const message = `Your investment in ${fundName} worth KES ${amount.toLocaleString()} has matured. Log in to HazinaHub to withdraw or reinvest.`;
  await sendSMS(phone, message);
}

/**
 * Send fraud alert notification
 */
export async function notifyFraudAlert(phone: string, description: string): Promise<void> {
  const message = `⚠️ Security Alert: ${description}. If this wasn't you, contact support immediately.`;
  await sendSMS(phone, message);
}
