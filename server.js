const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ORDERS_FILE = path.join(__dirname, 'orders.json');

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
      fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
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
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlParts = (req.url || '/').split('?');
  const reqPath = urlParts[0];

  // API 1: Initiate Order / Record Abandoned Lead
  if (reqPath === '/api/order/initiate' && req.method === 'POST') {
    const data = await parseBody(req);
    const orders = readOrders();

    const newOrder = {
      id: `ord_${Date.now()}`,
      order_id: `lead_${(data.phone || '').replace(/\D/g, '') || Date.now()}`,
      name: (data.name || '').trim() || 'Guest',
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      amount: data.amount || 1,
      status: 'ABANDONED', // Starts as Abandoned until payment completes
      payment_id: null,
      date: new Date().toISOString()
    };

    orders.unshift(newOrder);
    saveOrders(orders);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, orderId: newOrder.id }));
    return;
  }

  // API 2: Mark Order as Paid
  if (reqPath === '/api/order/complete' && req.method === 'POST') {
    const data = await parseBody(req);
    const orders = readOrders();

    // Match by orderId or email/phone
    let updated = false;
    for (let ord of orders) {
      if ((data.orderId && ord.id === data.orderId) || (data.email && ord.email.toLowerCase() === data.email.toLowerCase())) {
        ord.status = 'PAID';
        ord.payment_id = data.payment_id || `pay_${Date.now()}`;
        ord.paid_at = new Date().toISOString();
        if (data.amount) ord.amount = data.amount;
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
        amount: data.amount || 1,
        status: 'PAID',
        payment_id: data.payment_id || `pay_${Date.now()}`,
        date: new Date().toISOString(),
        paid_at: new Date().toISOString()
      });
    }

    saveOrders(orders);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // API 3: Get All Orders for Admin Dashboard
  if (reqPath === '/api/admin/orders' && req.method === 'GET') {
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
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

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

  // Static File Serving & Admin Route
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
});

server.listen(PORT, () => {
  console.log(`Landing Page Server running at http://localhost:${PORT}`);
  console.log(`Admin Panel available at http://localhost:${PORT}/admin`);
});
