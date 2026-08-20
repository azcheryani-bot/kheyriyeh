import express from 'express';
import { SocksProxyAgent } from 'socks-proxy-agent';
import axios from 'axios';
const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.text({ type: ['text/xml', 'application/xml'], limit: '5mb' }));

const SOCKS_PROXY = 'socks5://127.0.0.1:1080';
const httpsAgent = new SocksProxyAgent(SOCKS_PROXY);
const httpAgent = new SocksProxyAgent(SOCKS_PROXY);

app.use(async (req, res) => {
  try {
    const targetUrl = req.headers['x-target-url'];
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing x-target-url header' });
    }
    
    console.log(`[SMS Bridge] Proxying request to: ${targetUrl}`);
    
    // Forward the request via proxy
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': req.headers['accept'] || '*/*',
        'SOAPAction': req.headers['soapaction'] || ''
      },
      data: req.method === 'GET' ? undefined : req.body,
      httpAgent,
      httpsAgent,
      timeout: 20000,
      validateStatus: () => true, // Don't throw on 4xx/5xx
      responseType: 'text' // Keep as raw text for XML parsing compatibility
    });
    
    // Transfer content-type
    res.set('Content-Type', response.headers['content-type']);
    res.status(response.status).send(response.data);
  } catch (err) {
    console.error('[SMS Bridge Error]', err.message);
    res.status(500).json({ error: 'Bridge Error', details: err.message });
  }
});

const PORT = 3005;
app.listen(PORT, () => {
  console.log(`SMS Bridge running on port ${PORT}`);
});
