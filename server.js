const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const ORDERS_FILE = isVercel ? path.join('/tmp', 'orders.json') : path.join(__dirname, 'orders.json');
const CAPI_CONFIG_FILE = isVercel ? path.join('/tmp', 'capi_config.json') : path.join(__dirname, 'capi_config.json');

function readCapiConfig() {
  try {
    if (!fs.existsSync(CAPI_CONFIG_FILE)) {
      const seedFile = path.join(__dirname, 'capi_config.json');
      if (isVercel && fs.existsSync(seedFile)) {
        try {
          const content = fs.readFileSync(seedFile, 'utf8');
          fs.writeFileSync(CAPI_CONFIG_FILE, content, 'utf8');
          return JSON.parse(content);
        } catch (e) {}
      }
      const defaultCfg = {
        pixel_id: process.env.FB_PIXEL_ID || '4879107795666392',
        access_token: process.env.FB_ACCESS_TOKEN || 'EAAdOWKUvli0BSivPSn2YSZBOEKxsr71ZCQtWhH9SQhpa6CPPjftvtHqYPLwxds1evdaIkTZBk2mLn1vsYQXZBKpVZAiVvIO2NpIKDIxEEtAi28GfrZAd9fYAHFuscrWFI7nAW0oZA6xoqMmUUQP7vZCBPFUNvWaE2YRwLqkB1t1XdPsa9bmcjDrdxHGsZA9eZB2wZDZD',
        test_code: process.env.FB_TEST_CODE || 'TEST69070'
      };
      try {
        fs.writeFileSync(CAPI_CONFIG_FILE, JSON.stringify(defaultCfg, null, 2), 'utf8');
      } catch (e) {}
      return defaultCfg;
    }
    return JSON.parse(fs.readFileSync(CAPI_CONFIG_FILE, 'utf8') || '{}');
  } catch (e) {
    return {
      pixel_id: '4879107795666392',
      access_token: 'EAAdOWKUvli0BSivPSn2YSZBOEKxsr71ZCQtWhH9SQhpa6CPPjftvtHqYPLwxds1evdaIkTZBk2mLn1vsYQXZBKpVZAiVvIO2NpIKDIxEEtAi28GfrZAd9fYAHFuscrWFI7nAW0oZA6xoqMmUUQP7vZCBPFUNvWaE2YRwLqkB1t1XdPsa9bmcjDrdxHGsZA9eZB2wZDZD',
      test_code: 'TEST69070'
    };
  }
}

function saveCapiConfig(cfg) {
  try {
    fs.writeFileSync(CAPI_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving capi config:', e.message);
  }
}

function hashSha256(str) {
  if (!str) return null;
  return crypto.createHash('sha256').update(String(str).trim().toLowerCase()).digest('hex');
}

function sendMetaCapiEvent(eventName, eventId, { name, email, phone, amount, currency, test_code }, req) {
  return new Promise((resolve) => {
    const config = readCapiConfig();
    const pixelId = config.pixel_id || '4879107795666392';
    const accessToken = config.access_token || process.env.FB_ACCESS_TOKEN || '';

    if (!accessToken) {
      console.log(`[Meta CAPI] Skipping ${eventName} (${eventId}): No access token provided yet.`);
      resolve({ skipped: true, reason: 'Access token not configured' });
      return;
    }

    try {
      const userData = {};

      if (email && email.includes('@')) {
        userData.em = [hashSha256(email)];
      }

      if (phone) {
        let cleanPhone = String(phone).replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        userData.ph = [hashSha256(cleanPhone)];
      }

      if (name) {
        const firstName = name.trim().split(' ')[0].toLowerCase();
        userData.fn = [hashSha256(firstName)];
      }

      if (req && req.headers) {
        const rawIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress);
        if (rawIp) {
          userData.client_ip_address = String(rawIp).split(',')[0].trim();
        }
        if (req.headers['user-agent']) {
          userData.client_user_agent = req.headers['user-agent'];
        }
      }

      const eventItem = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || `ev_${Date.now()}`,
        event_source_url: (req && req.headers && (req.headers.referer || req.headers.origin)) || 'https://intdropshippingcourse.vercel.app',
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: currency || 'INR',
          value: Number(amount) || 199.00,
          content_name: 'International Dropshipping Blueprint (PDF + 5 Bonuses)',
          content_type: 'product'
        }
      };

      const payload = {
        data: [eventItem]
      };

      const testCode = test_code || config.test_code;
      if (testCode) {
        payload.test_event_code = testCode;
      }

      const payloadString = JSON.stringify(payload);
      const postReq = https.request(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString)
        },
        timeout: 5000
      }, (postRes) => {
        let resBody = '';
        postRes.on('data', chunk => (resBody += chunk));
        postRes.on('end', () => {
          try {
            const parsed = JSON.parse(resBody);
            console.log(`[Meta CAPI ${eventName}] Status ${postRes.statusCode}:`, resBody);
            resolve({ success: postRes.statusCode === 200, statusCode: postRes.statusCode, data: parsed });
          } catch (e) {
            resolve({ success: postRes.statusCode === 200, statusCode: postRes.statusCode, raw: resBody });
          }
        });
      });

      postReq.on('error', (err) => {
        console.error(`[Meta CAPI ${eventName}] Error:`, err.message);
        resolve({ success: false, error: err.message });
      });

      postReq.on('timeout', () => {
        postReq.destroy();
        resolve({ success: false, error: 'Timeout' });
      });

      postReq.write(payloadString);
      postReq.end();
    } catch (e) {
      console.error(`[Meta CAPI] Exception:`, e.message);
      resolve({ success: false, error: e.message });
    }
  });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function readOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) {
      const seedFile = path.join(__dirname, 'orders.json');
      if (isVercel && fs.existsSync(seedFile)) {
        try {
          const content = fs.readFileSync(seedFile, 'utf8');
          fs.writeFileSync(ORDERS_FILE, content, 'utf8');
          return JSON.parse(content);
        } catch (e) {}
      }
      try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
      } catch (e) {}
    }
    const data = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving orders:', e.message);
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'object') return resolve(req.body);
      if (typeof req.body === 'string') {
        try {
          return resolve(JSON.parse(req.body));
        } catch (e) {
          return resolve({});
        }
      }
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

async function handleRequest(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Passcode, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawUrl = req.headers['x-matched-path'] || req.url || '/';
  const urlParts = rawUrl.split('?');
  const reqPath = urlParts[0];

  // API 1: Initiate Order / Record Abandoned Lead & Trigger CAPI
  if ((reqPath === '/api/order/initiate' || reqPath.endsWith('/order/initiate')) && req.method === 'POST') {
    const data = await parseBody(req);
    const orders = readOrders();

    const newOrder = {
      id: `ord_${Date.now()}`,
      order_id: `lead_${(data.phone || '').replace(/\D/g, '') || Date.now()}`,
      name: (data.name || '').trim() || 'Guest',
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      amount: 199,
      status: 'ABANDONED', // Starts as Abandoned until payment completes
      payment_id: null,
      date: new Date().toISOString()
    };

    orders.unshift(newOrder);
    saveOrders(orders);

    // Trigger Meta Conversions API (CAPI) InitiateCheckout
    sendMetaCapiEvent('InitiateCheckout', data.eventId, {
      name: newOrder.name,
      email: newOrder.email,
      phone: newOrder.phone,
      amount: 199.00,
      test_code: data.test_code
    }, req).catch(err => console.warn('CAPI InitiateCheckout note:', err.message));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, orderId: newOrder.id }));
    return;
  }

  // API 2: Mark Order as Paid & Trigger CAPI Purchase
  if ((reqPath === '/api/order/complete' || reqPath.endsWith('/order/complete')) && req.method === 'POST') {
    const data = await parseBody(req);
    const orders = readOrders();

    // Match by orderId or email/phone
    let updated = false;
    for (let ord of orders) {
      if ((data.orderId && ord.id === data.orderId) || (data.email && ord.email.toLowerCase() === data.email.toLowerCase())) {
        ord.status = 'PAID';
        ord.payment_id = data.payment_id || `pay_${Date.now()}`;
        ord.paid_at = new Date().toISOString();
        updated = true;
        break;
      }
    }

    if (!updated) {
      // Create new paid entry if not found
      orders.unshift({
        id: `ord_${Date.now()}`,
        order_id: `lead_${Date.now()}`,
        name: data.name || 'Customer',
        email: data.email || '',
        phone: data.phone || '',
        amount: 199,
        status: 'PAID',
        payment_id: data.payment_id || `pay_${Date.now()}`,
        date: new Date().toISOString(),
        paid_at: new Date().toISOString()
      });
    }

    saveOrders(orders);

    // Trigger Meta Conversions API (CAPI) Purchase
    sendMetaCapiEvent('Purchase', data.eventId, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      amount: 199.00,
      test_code: data.test_code
    }, req).catch(err => console.warn('CAPI Purchase note:', err.message));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // API 3: Get All Orders for Admin Dashboard
  if ((reqPath === '/api/admin/orders' || reqPath.endsWith('/admin/orders')) && req.method === 'GET') {
    const authHeader = req.headers['x-admin-passcode'] || '';
    const searchParams = new URL(req.url, 'http://localhost').searchParams;
    const queryPass = searchParams.get('passcode') || '';

    if (authHeader !== 'dropshippingadmin' && queryPass !== 'dropshippingadmin') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid Passcode' }));
      return;
    }

    const orders = readOrders();
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const abandonedOrders = orders.filter(o => o.status === 'ABANDONED');
    const totalRevenue = paidOrders.length * 199;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      stats: {
        totalOrders: orders.length,
        paidCount: paidOrders.length,
        abandonedCount: abandonedOrders.length,
        totalRevenue: totalRevenue,
        conversionRate: orders.length > 0 ? ((paidOrders.length / orders.length) * 100).toFixed(1) : 0
      },
      orders: orders
    }));
    return;
  }

  // API 4: Get & Update Meta CAPI Settings
  if (reqPath === '/api/admin/capi-settings' || reqPath.endsWith('/admin/capi-settings')) {
    const authHeader = req.headers['x-admin-passcode'] || '';
    if (authHeader !== 'dropshippingadmin') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    if (req.method === 'GET') {
      const cfg = readCapiConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        pixel_id: cfg.pixel_id || '4879107795666392',
        has_token: Boolean(cfg.access_token),
        test_code: cfg.test_code || ''
      }));
      return;
    }

    if (req.method === 'POST') {
      const data = await parseBody(req);
      const cfg = readCapiConfig();
      if (data.pixel_id) cfg.pixel_id = data.pixel_id.trim();
      if (data.access_token !== undefined) cfg.access_token = data.access_token.trim();
      if (data.test_code !== undefined) cfg.test_code = data.test_code.trim();
      saveCapiConfig(cfg);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Settings saved successfully' }));
      return;
    }
  }

  // API 5: Send Test Event to Meta Conversions API
  if ((reqPath === '/api/admin/capi-test' || reqPath.endsWith('/admin/capi-test')) && req.method === 'POST') {
    const authHeader = req.headers['x-admin-passcode'] || '';
    if (authHeader !== 'dropshippingadmin') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    const data = await parseBody(req);
    const eventName = data.event_name || 'Purchase';

    const testRes = await sendMetaCapiEvent(eventName, `test_pur_${Date.now()}`, {
      name: 'Gurfateh Singh',
      email: 'fatehxgames12@gmail.com',
      phone: '9876543210',
      amount: 199.00
    }, req);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(testRes));
    return;
  }

  // If running on Vercel and not an API route, return 404 JSON (Vercel CDN serves static files)
  if (isVercel) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
    return;
  }

  // Static File Serving & Admin Route (Local Server)
  let targetPath = reqPath;
  if (targetPath === '/' || targetPath === '') {
    targetPath = '/index.html';
  } else if (targetPath === '/admin' || targetPath === '/admin/') {
    targetPath = '/admin.html';
  }

  const filePath = path.join(__dirname, targetPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Landing Page Server running at http://localhost:${PORT}`);
    console.log(`Admin Panel available at http://localhost:${PORT}/admin`);
  });
}

module.exports = handleRequest;
