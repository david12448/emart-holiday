// Validate the small public route index without exposing private source mappings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routesDir = path.join(root, 'data', 'public-routes', 'emart');
const prefix = '/emart-holiday/';
const publicRoute = /^\/emart-holiday\/emart\/(?:[a-z0-9-]+\/)*$/;

function validateRoute(value) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'route must be an object');
  assert.deepEqual(Object.keys(value), ['path'], 'only public path is allowed');
  assert.equal(typeof value.path, 'string', 'path must be a string');
  assert.match(value.path, publicRoute, 'route must be a clean local static path');
  const parsed = new URL(value.path, 'https://preview.example');
  assert.equal(parsed.origin, 'https://preview.example', 'external URLs are forbidden');
  assert.equal(parsed.pathname, value.path, 'encoded or normalized paths are forbidden');
  assert.equal(parsed.search, '');
  assert.equal(parsed.hash, '');
  return value.path;
}

// Negative fixtures guard against adding internal URLs to otherwise allowed JSON.
for (const invalid of [
  {path: '/emart-holiday/emart/seoul/', sourceUrl: 'https://private.example/source'},
  {path: 'https://private.example/source'},
  {path: '//private.example/source'},
  {path: '/emart-holiday/emart/../private/'},
  {path: '/emart-holiday/emart/seoul/?token=example'},
  {path: '/emart-holiday/emart/%2e%2e/private/'},
  {path: '/emart-holiday/emart/seoul/', collector: '/private/collector'}
]) {
  assert.throws(() => validateRoute(invalid), 'private or malformed route must be rejected');
}

const files = fs.readdirSync(routesDir).filter(name => name.endsWith('.json'));
assert.ok(files.length > 0, 'public route index must not be empty');
for (const name of files) {
  const item = JSON.parse(fs.readFileSync(path.join(routesDir, name), 'utf8'));
  const route = validateRoute(item);
  const relative = route.slice(prefix.length);
  assert.ok(fs.existsSync(path.join(root, relative, 'index.html')),
    `route target missing for ${name}`);
}
console.log(`Validated ${files.length} public route records and rejection fixtures`);
