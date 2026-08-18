import { readProducts } from './shoprenter.js';
import { findByEans, resolveVatId, saveOffers } from './emag.js';

function eanMatchesByCode(results) {
  const map = new Map();
  for (const item of results || []) {
    for (const ean of item?.eans || []) map.set(String(ean), item);
  }
  return map;
}

export async function previewOfferSync(cfg, limit = 5) {
  const products = await readProducts(cfg.shoprenter, limit);
  const valid = products.filter((p) => p.innerId && p.gtin && p.netPrice > 0);
  const matches = await findByEans(cfg.emag, valid.map((p) => p.gtin));
  const byEan = eanMatchesByCode(matches);
  const vatId = await resolveVatId(cfg.emag, 27);

  return valid.map((p) => {
    const match = byEan.get(p.gtin);
    const canAttach = Boolean(match?.allow_to_add_offer) && !Boolean(match?.vendor_has_offer);
    const alreadyHasOffer = Boolean(match?.vendor_has_offer);
    const status = p.active && p.stock > 0 ? 1 : 0;
    const salePrice = Number(p.netPrice.toFixed(4));
    const offer = match && (canAttach || alreadyHasOffer) ? {
      id: p.innerId,
      ...(match.part_number_key ? { part_number_key: match.part_number_key } : {}),
      status,
      sale_price: salePrice,
      min_sale_price: Number((salePrice * cfg.emag.minPriceFactor).toFixed(4)),
      max_sale_price: Number((salePrice * cfg.emag.maxPriceFactor).toFixed(4)),
      stock: [{ warehouse_id: cfg.emag.warehouseId, value: p.stock }],
      handling_time: [{ warehouse_id: cfg.emag.warehouseId, value: cfg.emag.handlingTime }],
      vat_id: vatId,
      ...(p.gtin ? { ean: [p.gtin] } : {})
    } : null;

    return {
      shoprenter: { id: p.innerId, sku: p.sku, gtin: p.gtin, netPrice: p.netPrice, stock: p.stock, active: p.active },
      emag: match ? {
        part_number_key: match.part_number_key || null,
        product_name: match.product_name || null,
        category_name: match.category_name || null,
        allow_to_add_offer: Boolean(match.allow_to_add_offer),
        vendor_has_offer: Boolean(match.vendor_has_offer)
      } : null,
      action: !match ? 'NO_EMAG_MATCH' : alreadyHasOffer ? 'UPDATE_OR_ATTACH_CHECK' : canAttach ? 'ATTACH_OFFER' : 'BLOCKED',
      offer
    };
  });
}

export async function executeOfferSync(cfg, limit = 5) {
  const preview = await previewOfferSync(cfg, limit);
  const candidates = preview.filter((x) => x.offer && x.action !== 'BLOCKED').map((x) => x.offer);
  if (!candidates.length) return { preview, result: { isError: false, messages: ['Nincs szinkronizálható termék.'], results: [] } };
  const result = await saveOffers(cfg.emag, candidates);
  return { preview, result };
}
