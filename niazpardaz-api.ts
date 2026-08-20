import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Creating a SOCKS agent to connect via the local Xray instance
const agent = new SocksProxyAgent('socks://127.0.0.1:1080');

// Create a dedicated Axios client for NiazPardaz API
const smsClient = axios.create({
  baseURL: 'https://payamak.niazpardaz.ir', // adjust according to actual API URL
  httpAgent: agent,
  httpsAgent: agent,
  timeout: 10000,
});

export async function sendSms(phoneNumber: string, message: string) {
  try {
    const response = await smsClient.post('/api/v1/send', {
      to: phoneNumber,
      text: message,
    }, {
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${process.env.NIAZPARDAR_API_KEY}`
      }
    });

    console.log('SMS sent successfully!', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending SMS via proxy:', error);
    throw error;
  }
}

export async function checkIpViaProxy() {
  try {
    // This will test if the traffic is actually going through the proxy IP
    const response = await smsClient.get('https://api.ipify.org?format=json');
    console.log('Your IP via proxy is:', response.data.ip);
    return response.data.ip;
  } catch (error) {
    console.error('Failed to check IP via proxy:', error);
  }
}
