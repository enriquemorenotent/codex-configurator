import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVariantSelection,
  buildVariantSelectorOptions,
  resolveMixedVariantBackNavigationPath,
  resolveObjectVariantNavigationPath,
} from '../src/variantPresets.js';

test('buildVariantSelectorOptions includes scalar and object preset options', () => {
  const options = buildVariantSelectorOptions({
    kind: 'scalar_object',
    scalarOptions: ['none', 'statsig'],
    objectVariants: [
      {
        id: 'object_1',
        label: 'otlp-http',
        requiredKeys: ['endpoint', 'protocol'],
        fixedValues: {},
      },
      {
        id: 'object_2',
        label: 'otlp-grpc',
        requiredKeys: ['endpoint'],
        fixedValues: {},
      },
    ],
  });

  assert.deepEqual(
    options.map((option) => option.label),
    ['none', 'statsig', 'otlp-http /', 'otlp-grpc /']
  );
  assert.deepEqual(
    options.map((option) => option.kind),
    ['scalar', 'scalar', 'object', 'object']
  );
});

test('applyVariantSelection applies scalar variants without object navigation', () => {
  const result = applyVariantSelection({
    currentValue: { mode: 'custom' },
    selectedVariant: {
      kind: 'scalar',
      value: 'never',
    },
  });

  assert.equal(result.changed, true);
  assert.equal(result.isObjectSelection, false);
  assert.equal(result.isObjectVariantSwitch, false);
  assert.equal(result.navigateToObject, false);
  assert.equal(result.nextValue, 'never');
});

test('applyVariantSelection seeds required keys and fixed values for object variants', () => {
  const result = applyVariantSelection({
    currentValue: 'none',
    selectedVariant: {
      kind: 'object',
      id: 'object_1',
      label: 'otlp-http',
      requiredKeys: ['endpoint', 'protocol', 'headers'],
      fixedValues: {
        protocol: 'json',
      },
    },
    resolveDefaultValue: (requiredKey) => {
      if (requiredKey === 'endpoint') {
        return 'https://otel.example.com/v1/traces';
      }

      if (requiredKey === 'headers') {
        return {};
      }

      return '';
    },
  });

  assert.equal(result.changed, true);
  assert.equal(result.isObjectSelection, true);
  assert.equal(result.isObjectVariantSwitch, false);
  assert.equal(result.navigateToObject, true);
  assert.deepEqual(result.nextValue, {
    endpoint: 'https://otel.example.com/v1/traces',
    protocol: 'json',
    headers: {},
  });
});

test('applyVariantSelection keeps matching object variants unchanged but still navigates', () => {
  const currentValue = {
    endpoint: 'https://otel.example.com/v1/traces',
    protocol: 'json',
  };

  const result = applyVariantSelection({
    currentValue,
    selectedVariant: {
      kind: 'object',
      id: 'object_1',
      label: 'otlp-http',
      requiredKeys: ['endpoint', 'protocol'],
      fixedValues: {
        protocol: 'json',
      },
    },
    resolveDefaultValue: () => {
      throw new Error('resolveDefaultValue should not be called for existing required keys');
    },
  });

  assert.equal(result.changed, false);
  assert.equal(result.isObjectSelection, true);
  assert.equal(result.isObjectVariantSwitch, false);
  assert.equal(result.navigateToObject, true);
  assert.deepEqual(result.nextValue, currentValue);
});

test('applyVariantSelection resets stale branch keys when switching object presets', () => {
  const result = applyVariantSelection({
    currentValue: {
      'otlp-http': {
        endpoint: 'https://otel-http.example.com/v1/traces',
      },
      stale_key: true,
    },
    selectedVariant: {
      kind: 'object',
      id: 'object_2',
      label: 'otlp-grpc',
      requiredKeys: ['otlp-grpc'],
      fixedValues: {},
    },
    resolveDefaultValue: (requiredKey) => {
      if (requiredKey === 'otlp-grpc') {
        return {
          endpoint: 'grpc://otel-grpc.example.com:4317',
        };
      }

      return {};
    },
  });

  assert.equal(result.changed, true);
  assert.equal(result.isObjectSelection, true);
  assert.equal(result.isObjectVariantSwitch, true);
  assert.equal(result.navigateToObject, true);
  assert.deepEqual(result.nextValue, {
    'otlp-grpc': {
      endpoint: 'grpc://otel-grpc.example.com:4317',
    },
  });
});

test('resolveObjectVariantNavigationPath uses preferred nested key when available', () => {
  const path = resolveObjectVariantNavigationPath({
    basePath: ['approval_policy'],
    nextValue: {
      reject: {
        mcp_elicitations: false,
      },
      stale_branch: {
        sandbox_approval: false,
      },
    },
    preferredKey: 'reject',
  });

  assert.deepEqual(path, ['approval_policy', 'reject']);
});

test('resolveObjectVariantNavigationPath falls back to only nested container key', () => {
  const path = resolveObjectVariantNavigationPath({
    basePath: ['otel', 'exporter'],
    nextValue: {
      'otlp-http': {
        endpoint: '',
      },
    },
    preferredKey: null,
  });

  assert.deepEqual(path, ['otel', 'exporter', 'otlp-http']);
});

test('resolveObjectVariantNavigationPath stays on base path when no container child exists', () => {
  const path = resolveObjectVariantNavigationPath({
    basePath: ['foo'],
    nextValue: {
      mode: 'strict',
    },
    preferredKey: 'mode',
  });

  assert.deepEqual(path, ['foo']);
});

test('resolveMixedVariantBackNavigationPath skips intermediate mixed object level', () => {
  const path = resolveMixedVariantBackNavigationPath({
    pathSegments: ['approval_policy', 'reject'],
    resolveVariantMeta: (segments, key) => {
      if (segments.join('.') === '' && key === 'approval_policy') {
        return {
          kind: 'scalar_object',
          objectSchemaPaths: ['reject.mcp_elicitations', 'reject.rules'],
          objectVariants: [
            {
              requiredKeys: ['reject'],
            },
          ],
        };
      }

      return null;
    },
  });

  assert.deepEqual(path, []);
});

test('resolveMixedVariantBackNavigationPath keeps normal parent for non-mixed paths', () => {
  const path = resolveMixedVariantBackNavigationPath({
    pathSegments: ['approval_policy', 'reject', 'rules'],
    resolveVariantMeta: () => null,
  });

  assert.equal(path, null);
});
