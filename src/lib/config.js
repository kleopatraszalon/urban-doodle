export function config() {
  const shopName = (process.env.SHOPRENTER_SHOP_NAME || '').trim();
  return {
    port: Number(process.env.PORT || 10000),
    adminToken: process.env.ADMIN_TOKEN || '',
    shoprenter: {
      shopName,
      clientId: process.env.SHOPRENTER_CLIENT_ID || '',
      clientSecret: process.env.SHOPRENTER_CLIENT_SECRET || '',
      legacyUsername: process.env.SHOPRENTER_API_USERNAME || '',
      legacyPassword: process.env.SHOPRENTER_API_PASSWORD || '',
      oauthUrl: shopName ? `https://oauth.app.shoprenter.net/${encodeURIComponent(shopName)}/app/token` : '',
      api2Base: shopName ? `https://${shopName}.api2.myshoprenter.hu/api` : '',
      legacyBase: shopName ? `https://${shopName}.api.myshoprenter.hu` : ''
    },
    emag: {
      baseUrl: (process.env.EMAG_API_BASE || 'https://marketplace-api.emag.hu/api-3').replace(/\/$/, ''),
      username: process.env.EMAG_API_USERNAME || '',
      password: process.env.EMAG_API_PASSWORD || '',
      vatId: process.env.EMAG_VAT_ID ? Number(process.env.EMAG_VAT_ID) : null,
      warehouseId: Number(process.env.EMAG_WAREHOUSE_ID || 0),
      handlingTime: Number(process.env.EMAG_HANDLING_TIME || 1),
      minPriceFactor: Number(process.env.EMAG_MIN_PRICE_FACTOR || 0.8),
      maxPriceFactor: Number(process.env.EMAG_MAX_PRICE_FACTOR || 1.5)
    }
  };
}

export function publicConfigStatus(c = config()) {
  const srModern = Boolean(c.shoprenter.shopName && c.shoprenter.clientId && c.shoprenter.clientSecret);
  const srLegacy = Boolean(c.shoprenter.shopName && c.shoprenter.legacyUsername && c.shoprenter.legacyPassword);
  return {
    adminProtected: Boolean(c.adminToken),
    shoprenter: {
      configured: srModern || srLegacy,
      authMode: srModern ? 'oauth2' : srLegacy ? 'legacy-basic' : 'missing',
      shopName: c.shoprenter.shopName || null
    },
    emag: {
      configured: Boolean(c.emag.username && c.emag.password),
      baseUrl: c.emag.baseUrl,
      vatIdConfigured: Number.isFinite(c.emag.vatId)
    }
  };
}
