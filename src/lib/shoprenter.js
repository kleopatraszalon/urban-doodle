import { fetchJson } from './http.js';

let tokenCache = { token: null, expiresAt: 0 };

function basicHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

async function getAccessToken(cfg) {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
  const { body } = await fetchJson(cfg.oauthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret
    })
  });
  if (!body?.access_token) throw new Error('A Shoprenter nem adott vissza access tokent.');
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in || 3600)) * 1000
  };
  return tokenCache.token;
}

async function authContext(cfg) {
  if (cfg.clientId && cfg.clientSecret) {
    const token = await getAccessToken(cfg);
    return { base: cfg.api2Base, authorization: `Bearer ${token}` };
  }
  if (cfg.legacyUsername && cfg.legacyPassword) {
    return { base: cfg.legacyBase, authorization: basicHeader(cfg.legacyUsername, cfg.legacyPassword) };
  }
  throw new Error('Hiányzik a Shoprenter API hitelesítés.');
}

export async function shoprenterRequest(cfg, path, options = {}) {
  const auth = await authContext(cfg);
  const sep = path.startsWith('/') ? '' : '/';
  const { body } = await fetchJson(`${auth.base}${sep}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': auth.authorization,
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return body;
}

export async function testShoprenter(cfg) {
  const data = await shoprenterRequest(cfg, '/products?page=0&limit=1&full=1');
  return { ok: true, sampleCount: Array.isArray(data?.items) ? data.items.length : undefined };
}

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intFromInnerId(p) {
  const n = Number(p?.innerId);
  if (!Number.isInteger(n) || n <= 0 || n > 16777215) return null;
  return n;
}

export async function readProducts(cfg, limit = 50) {
  const bounded = Math.max(1, Math.min(200, Number(limit) || 50));
  const data = await shoprenterRequest(cfg, `/products?page=0&limit=${bounded}&full=1`);
  return normalizeItems(data).map((p) => ({
    resourceId: p.id || null,
    innerId: intFromInnerId(p),
    sku: p.sku || '',
    modelNumber: p.modelNumber || '',
    gtin: String(p.gtin || '').replace(/\D/g, ''),
    netPrice: numberOrZero(p.price),
    stock: Math.max(0, Math.floor(numberOrZero(p.stock1) + numberOrZero(p.stock2) + numberOrZero(p.stock3) + numberOrZero(p.stock4))),
    active: String(p.status ?? '1') !== '0' && String(p.orderable ?? '1') !== '0',
    raw: p
  }));
}
