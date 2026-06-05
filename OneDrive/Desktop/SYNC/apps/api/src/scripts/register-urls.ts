import { registerC2BUrls } from '../services/mpesa.service';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function run() {
  console.log('🚀 Registering M-Pesa C2B URLs...');
  console.log('Config check:');
  console.log('- Shortcode:', process.env.MPESA_SHORTCODE);
  console.log('- Env:', process.env.MPESA_ENV);
  console.log('- Consumer Key set:', !!process.env.MPESA_CONSUMER_KEY);
  
  try {
    await registerC2BUrls();
    console.log('✨ Registration complete!');
  } catch (error: any) {
    console.error('❌ Registration failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error message:', error.message);
      console.error('Full error:', error);
    }
    process.exit(1);
  }
}

run();
