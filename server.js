const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const ORDERS_FILE = isVercel ? path.join('/tmp', 'orders.json') : path.join(__dirname, 'orders.json');
const CAPI_CONFIG_FILE = isVercel ? path.join('/tmp', 'capi_config.json') : path.join(__dirname, 'capi_config.json');

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'dropshippingadmin';

// Upstash / Vercel KV optional environment variables
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

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

function getEventSourceUrl(req) {
  if (req && req.headers) {
    if (req.headers.referer) return req.headers.referer;
    if (req.headers.origin) return req.headers.origin;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) return `${proto}://${host}`;
  }
  return 'https://intdropshippingcourse.vercel.app';
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
        event_source_url: getEventSourceUrl(req),
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: currency || 'INR',
          value: Number(amount) || 1.00,
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
        timeout: 6000
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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
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
    console.error('Error saving orders locally:', e.message);
  }

  // If Upstash/Vercel KV REST is configured, sync asynchronously
  if (KV_URL && KV_TOKEN) {
    syncOrdersToKv(orders).catch(err => console.warn('KV sync error:', err.message));
  }
}

async function syncOrdersToKv(orders) {
  try {
    const url = `${KV_URL.replace(/\/$/, '')}/set/dropship_orders`;
    const payload = JSON.stringify({ value: JSON.stringify(orders) });
    const postReq = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 3000
    });
    postReq.on('error', () => {});
    postReq.write(payload);
    postReq.end();
  } catch (e) {}
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

function getSanitizedPath(req) {
  if (req.endpoint) return req.endpoint;

  // Determine path from all possible environments (Vercel, AWS Lambda, Node server)
  const candidate = req.url || 
                    req.headers['x-invoke-path'] || 
                    req.headers['x-matched-path'] || 
                    '/';

  let clean = String(candidate).split('?')[0].trim();
  clean = clean.replace(/\/+/g, '/');

  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }

  if (clean.endsWith('.js')) {
    clean = clean.slice(0, -3);
  }

  return clean;
}

function isAuthorized(req) {
  const authHeader = req.headers['x-admin-passcode'] || '';
  const searchParams = new URL(req.url, 'http://localhost').searchParams;
  const queryPass = searchParams.get('passcode') || '';
  return (authHeader === ADMIN_PASSCODE || queryPass === ADMIN_PASSCODE);
}

async function handleRequest(req, res) {
  // CORS Headers for multi-domain support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Passcode, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqPath = getSanitizedPath(req);

  // Health Check & Diagnostic API
  if (reqPath === '/api/admin/health' || reqPath.endsWith('/admin/health')) {
    const orders = readOrders();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      status: 'healthy',
      environment: isVercel ? 'Vercel Serverless' : 'Local Node.js',
      detectedHost: req.headers.host || 'unknown',
      orderCount: orders.length,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // API 1: Initiate Order / Record Abandoned Lead & Trigger CAPI InitiateCheckout
  if ((reqPath === '/api/order/initiate' || reqPath.endsWith('/order/initiate')) && req.method === 'POST') {
    const data = await parseBody(req);
    const orders = readOrders();

    const newOrder = {
      id: `ord_${Date.now()}`,
      order_id: `lead_${(data.phone || '').replace(/\D/g, '') || Date.now()}`,
      name: (data.name || '').trim() || 'Guest',
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      amount: data.amount ? Number(data.amount) : 1,
      status: 'ABANDONED', // Starts as Abandoned until payment completes
      contacted: false,
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
      amount: newOrder.amount || 1.00,
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

    let updated = false;
    for (let ord of orders) {
      if ((data.orderId && ord.id === data.orderId) || (data.email && ord.email && ord.email.toLowerCase() === data.email.toLowerCase())) {
        ord.status = 'PAID';
        ord.payment_id = data.payment_id || `pay_${Date.now()}`;
        ord.paid_at = new Date().toISOString();
        if (data.amount) ord.amount = Number(data.amount);
        updated = true;
        break;
      }
    }

    if (!updated) {
      orders.unshift({
        id: `ord_${Date.now()}`,
        order_id: `lead_${Date.now()}`,
        name: data.name || 'Customer',
        email: data.email || '',
        phone: data.phone || '',
        amount: data.amount ? Number(data.amount) : 1,
        status: 'PAID',
        contacted: false,
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
      amount: data.amount ? Number(data.amount) : 1.00,
      test_code: data.test_code
    }, req).catch(err => console.warn('CAPI Purchase note:', err.message));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // API 3: Get All Orders for Admin Dashboard
  if ((reqPath === '/api/admin/orders' || reqPath.endsWith('/admin/orders')) && req.method === 'GET') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid Passcode' }));
      return;
    }

    const orders = readOrders();
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const abandonedOrders = orders.filter(o => o.status === 'ABANDONED');
    const contactedOrders = orders.filter(o => o.contacted === true || o.status === 'CONTACTED');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 1), 0);

    // Calculate Today's Stats
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayOrders = orders.filter(o => new Date(o.date).getTime() >= startOfToday);
    const todayPaid = todayOrders.filter(o => o.status === 'PAID');
    const todayRevenue = todayPaid.reduce((sum, o) => sum + (Number(o.amount) || 1), 0);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      stats: {
        totalOrders: orders.length,
        paidCount: paidOrders.length,
        abandonedCount: abandonedOrders.length,
        contactedCount: contactedOrders.length,
        totalRevenue: totalRevenue,
        recoverableRevenue: abandonedOrders.reduce((sum, o) => sum + (Number(o.amount) || 1), 0),
        conversionRate: orders.length > 0 ? ((paidOrders.length / orders.length) * 100).toFixed(1) : 0,
        todayCount: todayOrders.length,
        todayPaidCount: todayPaid.length,
        todayRevenue: todayRevenue
      },
      orders: orders
    }));
    return;
  }

  // API 4: Update Order (Status, Contacted tag, etc.)
  if ((reqPath === '/api/admin/orders/update' || reqPath.endsWith('/admin/orders/update')) && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    const data = await parseBody(req);
    const orders = readOrders();
    const target = orders.find(o => o.id === data.id);

    if (!target) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Order not found' }));
      return;
    }

    if (data.status) target.status = data.status;
    if (typeof data.contacted === 'boolean') target.contacted = data.contacted;
    if (data.name) target.name = data.name;
    if (data.phone) target.phone = data.phone;
    if (data.email) target.email = data.email;
    if (data.payment_id) target.payment_id = data.payment_id;

    saveOrders(orders);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, order: target }));
    return;
  }

  // API 5: Create Order Manually
  if ((reqPath === '/api/admin/orders/create' || reqPath.endsWith('/admin/orders/create')) && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    const data = await parseBody(req);
    const orders = readOrders();

    const manualOrder = {
      id: `ord_${Date.now()}`,
      order_id: `manual_${Date.now()}`,
      name: (data.name || 'Manual Customer').trim(),
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      amount: Number(data.amount) || 199,
      status: data.status || 'PAID',
      contacted: Boolean(data.contacted),
      payment_id: data.payment_id || `manual_pay_${Date.now()}`,
      date: new Date().toISOString()
    };

    orders.unshift(manualOrder);
    saveOrders(orders);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, order: manualOrder }));
    return;
  }

  // API 6: Delete Order
  if ((reqPath === '/api/admin/orders/delete' || reqPath.endsWith('/admin/orders/delete')) && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    const data = await parseBody(req);
    let orders = readOrders();
    const initialLen = orders.length;
    orders = orders.filter(o => o.id !== data.id);

    if (orders.length === initialLen) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Order not found' }));
      return;
    }

    saveOrders(orders);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Order deleted' }));
    return;
  }

  // API 7: Bulk Sync / Restore Orders
  if ((reqPath === '/api/admin/orders/sync' || reqPath.endsWith('/admin/orders/sync')) && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    const data = await parseBody(req);
    const newItems = Array.isArray(data.orders) ? data.orders : [];
    let currentOrders = readOrders();
    const map = new Map();

    // Preserve existing orders
    for (let ord of currentOrders) {
      if (ord.id) map.set(ord.id, ord);
    }

    // Merge incoming orders
    for (let ord of newItems) {
      if (ord.id) {
        map.set(ord.id, Object.assign({}, map.get(ord.id) || {}, ord));
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    saveOrders(merged);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: merged.length }));
    return;
  }

  // API 8: Get & Update Meta CAPI Settings
  if (reqPath === '/api/admin/capi-settings' || reqPath.endsWith('/admin/capi-settings')) {
    if (!isAuthorized(req)) {
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

  // API 9: Send Test Event to Meta Conversions API
  if ((reqPath === '/api/admin/capi-test' || reqPath.endsWith('/admin/capi-test')) && req.method === 'POST') {
    if (!isAuthorized(req)) {
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

  // If request begins with /api/ and wasn't handled, return a clean 404 JSON response
  if (reqPath.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: `Endpoint not found: ${reqPath}` }));
    return;
  }

  // If on Vercel CDN, static files are handled by Vercel edge
  if (isVercel) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  // Static File Serving & Admin Route (Local Server)
  let targetPath = reqPath;
  if (targetPath === '/' || targetPath === '') {
    targetPath = '/index.html';
  } else if (targetPath === '/admin' || targetPath === '/admin/' || targetPath === '/dashboard') {
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
