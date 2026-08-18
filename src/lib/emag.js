import { fetchJson } from './http.js';

function authHeader(cfg) {
  if (!cfg.username || !cfg.password) throw new Error('Hiányzik az eMAG API felhasználónév vagy jelszó.');
  return `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`, 'utf8').toString('base64')}`;
}

export async function emagRequest(cfg, path, { method = 'POST', body = {} } = {}) {
  const url = `${cfg.baseUrl}/${path.replace(/^\//, '')}`;
  const options = {
    method,
    headers: {
      'Authorization': authHeader(cfg),
      'Accept': 'application/json',
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {})
    }
  };
  if (method !== 'GET') options.body = JSON.stringify(body ?? {});
  const { body: result } = await fetchJson(url, options);
  return result;
}

export async function testEmag(cfg) {
  const result = await emagRequest(cfg, '/vat/read', { body: {} });
  return { ok: result?.isError === false, messages: result?.messages || [], vatCount: Array.isArray(result?.results) ? result.results.length : undefined };
}

export async function readOffers(cfg, limit = 100) {
  const result = await emagRequest(cfg, '/product_offer/read', {
    body: { currentPage: 1, itemsPerPage: Math.max(1, Math.min(100, Number(limit) || 100)) }
  });
  if (result?.isError) throw new Error(`eMAG hiba: ${(result.messages || []).join('; ')}`);
  return result?.results || [];
}

export async function readOrders(cfg, limit = 25) {
  const result = await emagRequest(cfg, '/order/read', {
    body: { currentPage: 1, itemsPerPage: Math.max(1, Math.min(100, Number(limit) || 25)), type: 3 }
  });
  if (result?.isError) throw new Error(`eMAG hiba: ${(result.messages || []).join('; ')}`);
  return result?.results || [];
}

export async function findByEans(cfg, eans) {
  const clean = [...new Set(eans.map((x) => String(x || '').replace(/\D/g, '')).filter((x) => x.length >= 6 && x.length <= 14))].slice(0, 100);
  if (!clean.length) return [];
  const qs = clean.map((ean) => `eans[]=${encodeURIComponent(ean)}`).join('&');
  const result = await emagRequest(cfg, `/documentation/find_by_eans?${qs}`, { method: 'GET' });
  if (result?.isError) throw new Error(`eMAG EAN keresési hiba: ${(result.messages || []).join('; ')}`);
  return result?.results || [];
}

export async function resolveVatId(cfg, desiredRate = 27) {
  if (Number.isFinite(cfg.vatId)) return cfg.vatId;
  const result = await emagRequest(cfg, '/vat/read', { body: {} });
  if (result?.isError) throw new Error(`eMAG VAT hiba: ${(result.messages || []).join('; ')}`);
  const rows = result?.results || [];
  const rate = Number(desiredRate);
  const found = rows.find((r) => {
    const values = [r?.value, r?.rate, r?.vat_rate, r?.vat, r?.name]
      .map((x) => String(x ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0])
      .map(Number)
      .filter(Number.isFinite);
    return values.some((v) => Math.abs(v - rate) < 0.01);
  });
  const id = Number(found?.id ?? found?.emag_id ?? found?.vat_id);
  if (!Number.isFinite(id)) throw new Error('Nem tudtam automatikusan meghatározni az eMAG ÁFA azonosítót. Állítsa be az EMAG_VAT_ID változót.');
  return id;
}

export async function saveOffers(cfg, offers) {
  if (!offers.length) return { isError: false, messages: [], results: [] };
  return emagRequest(cfg, '/product_offer/save', { body: { data: offers.slice(0, 50) } });
}
