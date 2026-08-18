import test from 'node:test';
import assert from 'node:assert/strict';
import { publicConfigStatus } from '../src/lib/config.js';

test('public config status never exposes secrets', () => {
  const s = publicConfigStatus({
    adminToken: 'secret',
    shoprenter: { shopName: 'kleoshop', clientId: 'a', clientSecret: 'b', legacyUsername: '', legacyPassword: '' },
    emag: { username: 'u', password: 'p', baseUrl: 'https://marketplace-api.emag.hu/api-3', vatId: 1 }
  });
  const serialized = JSON.stringify(s);
  assert.equal(serialized.includes('secret'), false);
  assert.equal(serialized.includes('"p"'), false);
  assert.equal(s.shoprenter.configured, true);
  assert.equal(s.emag.configured, true);
});
