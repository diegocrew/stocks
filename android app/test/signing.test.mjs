import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { configureUploadSigning } = require('../plugins/with-upload-signing.js');

test('prebuild signing is idempotent and overrides the template debug key for releases', () => {
  const generated = 'android { buildTypes { release { signingConfig signingConfigs.debug } } }\n';
  const result = configureUploadSigning(generated);
  assert.equal(configureUploadSigning(result), result);
  assert.ok(result.indexOf('signingConfig signingConfigs.stockAtlasUpload') > result.indexOf('signingConfig signingConfigs.debug'));
});

test('release signing fails closed for missing credentials without embedding secrets', () => {
  const result = configureUploadSigning('');
  assert.match(result, /throw new GradleException/);
  assert.match(result, /System\.getenv\("STOCK_ATLAS_KEYSTORE"\)/);
  assert.doesNotMatch(result, /storePassword ['"][^'"]+['"]/);
});
