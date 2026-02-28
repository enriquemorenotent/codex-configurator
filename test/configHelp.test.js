import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfigHelp, getConfigVariantMeta } from '../src/configHelp.js';

test('getConfigHelp provides actionable help for section keys', () => {
	const info = getConfigHelp([], 'tools');

	assert.equal(Boolean(info), true);
	assert.match(String(info.short), /(feature|toggle|tool)/i);
	assert.equal(typeof info.usage, 'string');
});

test('getConfigHelp keeps contextual help for projects trust_level', () => {
	const info = getConfigHelp(
		['projects', '/home/tester/project'],
		'trust_level',
	);

	assert.equal(Boolean(info), true);
	assert.match(String(info.short), /trust/i);
});

test('mixed scalar/object settings expose variant metadata', () => {
	const meta = getConfigVariantMeta([], 'approval_policy');

	assert.equal(meta?.kind, 'scalar_object');
	assert.equal(meta?.scalarOptions.includes('on-request'), true);
	assert.equal(meta?.scalarOptions.includes('never'), true);
	assert.equal(Array.isArray(meta?.objectVariants), true);
	assert.equal(meta.objectVariants.length > 0, true);
});

test('mixed scalar/object settings do not force extra usage copy', () => {
	const info = getConfigHelp([], 'approval_policy');

	assert.equal(Boolean(info), true);
	assert.equal(info.usage, null);
});
