import axios from 'axios';

async function testAuth() {
  try {
    console.log('1. Registering user...');
    // We register first since it might be a mock DB
    const regRes = await axios.post('http://localhost:5000/api/auth/register', {
      email: 'test@example.com',
      password: 'testPassword123',
      phone: '0700123456',
      firstName: 'Test',
      lastName: 'User',
      businessName: 'Test Business'
    }).catch(err => {
      if (err.response && err.response.status === 409) return { data: null };
      throw err;
    });

    console.log('2. Logging in...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'test@example.com',
      password: 'testPassword123'
    });
    
    const token = loginRes.data.data.accessToken;
    console.log('Token received:', token.substring(0, 20) + '...');
    
    console.log('3. Fetching profile...');
    const profileRes = await axios.get('http://localhost:5000/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Profile Response:', profileRes.data);
  } catch (err: any) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

testAuth();
