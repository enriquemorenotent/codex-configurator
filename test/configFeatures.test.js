import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getConfigFeatureDefinition,
  getConfigFeatureKeys,
} from '../src/configFeatures.js';

test('getConfigFeatureKeys follows upstream reference feature list', () => {
  const keys = getConfigFeatureKeys();

  assert.equal(keys.includes('elevated_windows_sandbox'), true);
  assert.equal(keys.includes('experimental_windows_sandbox'), true);
  assert.equal(keys.includes('web_search'), true);
  assert.equal(keys.includes('web_search_cached'), true);
  assert.equal(keys.includes('web_search_request'), true);
});

test('web search feature definitions are no longer marked deprecated', () => {
  assert.equal(Boolean(getConfigFeatureDefinition('web_search')?.deprecation), false);
  assert.equal(Boolean(getConfigFeatureDefinition('web_search_cached')?.deprecation), false);
  assert.equal(Boolean(getConfigFeatureDefinition('web_search_request')?.deprecation), false);
});
