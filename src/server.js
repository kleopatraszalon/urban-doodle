import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, publicConfigStatus } from './lib/config.js';
import { testShoprenter, readProducts } from './lib/shoprenter.js';
import { testEmag, readOffers, readOrders } from './lib/emag.js';
import { previewOfferSync, executeOfferSync } from './lib/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const cfg = config();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body, null, 2));
}

function authorized(req) {
  if (!cfg.adminToken) return true;
  const token = req.headers['x-admin-token'] || '';
  return token === cfg.adminToken;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw);
}

function publicError(err) {
  return {
    error: err?.message || String(err),
    status: err?.status || 500,
    detail: err?.body && typeof err.body !== 'string' ? err.body : undefined
  };
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') return json(res, 200, { ok: true, service: 'kleoshop-emag-bridge', time: new Date().toISOString() });

  if (url.pathname === '/' && req.method === 'GET') {
    const html = await fs.readFile(path.join(publicDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/callback/emag/') && !authorized(req)) return json(res, 401, { error: 'Hibás vagy hiányzó admin token.' });

  if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, publicConfigStatus(cfg));
  if (url.pathname === '/api/test/shoprenter' && req.method === 'POST') return json(res, 200, await testShoprenter(cfg.shoprenter));
  if (url.pathname === '/api/test/emag' && req.method === 'POST') return json(res, 200, await testEmag(cfg.emag));
  if (url.pathname === '/api/products/shoprenter' && req.method === 'GET') return json(res, 200, await readProducts(cfg.shoprenter, Number(url.searchParams.get('limit') || 25)));
  if (url.pathname === '/api/offers/emag' && req.method === 'GET') return json(res, 200, await readOffers(cfg.emag, Number(url.searchParams.get('limit') || 25)));
  if (url.pathname === '/api/orders/emag' && req.method === 'GET') return json(res, 200, await readOrders(cfg.emag, Number(url.searchParams.get('limit') || 25)));
  if (url.pathname === '/api/sync/preview' && req.method === 'GET') return json(res, 200, await previewOfferSync(cfg, Number(url.searchParams.get('limit') || 5)));
  if (url.pathname === '/api/sync/offers' && req.method === 'POST') {
    const body = await readBody(req);
    const limit = Math.max(1, Math.min(5, Number(body.limit || 5)));
    if (body.confirm !== 'SYNC5') return json(res, 400, { error: 'A próbaszinkronhoz confirm="SYNC5" szükséges.' });
    return json(res, 200, await executeOfferSync(cfg, limit));
  }
  if (url.pathname === '/api/callback/emag/order' && req.method === 'POST') {
    const body = await readBody(req);
    console.log(JSON.stringify({ event: 'emag-order-callback', time: new Date().toISOString(), body }));
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/callback/emag/order-cancel' && req.method === 'POST') {
    const body = await readBody(req);
    console.log(JSON.stringify({ event: 'emag-order-cancel-callback', time: new Date().toISOString(), body }));
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/callback/emag/return' && req.method === 'POST') {
    const body = await readBody(req);
    console.log(JSON.stringify({ event: 'emag-return-callback', time: new Date().toISOString(), body }));
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Nincs ilyen végpont.' });
}

const server = http.createServer(async (req, res) => {
  try { await route(req, res); }
  catch (err) {
    console.error(err);
    json(res, err?.status || 500, publicError(err));
  }
});

server.listen(cfg.port, '0.0.0.0', () => {
  console.log(`Kleoshop eMAG Bridge listening on 0.0.0.0:${cfg.port}`);
});
