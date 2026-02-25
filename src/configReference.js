import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CONFIG_SCHEMA_DATA = require('./reference/config-schema.json');

const ROOT_PLACEHOLDER = '<name>';
const PLACEHOLDER_SEGMENT = /^<[^>]+>$/;
const KEY_SEGMENT_PLACEHOLDERS = {
  agents: '<name>',
  apps: '<id>',
  js_repl_node_module_dirs: '<path>',
  mcp_servers: '<id>',
  model_providers: '<name>',
  notice: '<name>',
  profiles: '<name>',
  projects: '<path>',
  tools: '<tool>',
};
const KIND_PRIORITY = {
  value: 1,
  array: 2,
  table: 3,
};

const normalizeSegments = (segments) =>
  Array.isArray(segments) ? segments.map((segment) => String(segment)) : [];

const isPlaceholderSegment = (segment) =>
  PLACEHOLDER_SEGMENT.test(segment) || String(segment).endsWith('[]');

const isCustomIdPlaceholder = (segment) =>
  isPlaceholderSegment(segment) &&
  segment !== '<index>' &&
  !String(segment).endsWith('[]');

const normalizeType = (type) => String(type || '').replace(/\s+/g, ' ').trim();

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isPrimitiveValue = (type) =>
  type === 'string' || type === 'number' || type === 'integer' || type === 'boolean';

const isObjectLikeReference = (schema) => {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  if (Array.isArray(schema.type) && schema.type.includes('object')) {
    return true;
  }

  if (schema.type === 'object') {
    return true;
  }

  if (schema.properties || schema.additionalProperties || schema.patternProperties) {
    return true;
  }

  if (Array.isArray(schema.oneOf) || Array.isArray(schema.allOf) || Array.isArray(schema.anyOf)) {
    return true;
  }

  return false;
};

const isScalarLikeReference = (schema) => {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  if (isObjectLikeReference(schema)) {
    return false;
  }

  if (Array.isArray(schema.type) && schema.type.length > 0) {
    return schema.type.some(isPrimitiveValue);
  }

  if (isPrimitiveValue(normalizeType(schema.type))) {
    return true;
  }

  return Array.isArray(schema.enum);
};

const getOneOfTypeLabel = (branches, context) => {
  const unique = [...new Set(branches.map((branch) => getTypeLabel(branch, context)).filter(Boolean))];
  if (unique.length === 0) {
    return 'value';
  }

  return unique.length === 1 ? unique[0] : unique.join(' | ');
};

const getPlaceholderForSegment = (segment, fallback = ROOT_PLACEHOLDER) =>
  segment && KEY_SEGMENT_PLACEHOLDERS[segment] ? KEY_SEGMENT_PLACEHOLDERS[segment] : fallback;

const getResolvedDefinition = (schema, definitions, visitedRefs = new Set()) => {
  if (!schema || typeof schema !== 'object' || typeof schema.$ref !== 'string') {
    return { schema, refName: null };
  }

  const match = schema.$ref.match(/^#\/definitions\/(.+)$/);
  if (!match) {
    return { schema, refName: null };
  }

  const [, refName] = match;
  const definition = definitions.get(refName);
  if (!definition || visitedRefs.has(definition)) {
    return { schema: definition || schema, refName: null };
  }

  const nextVisitedRefs = new Set(visitedRefs);
  nextVisitedRefs.add(definition);

  const [merged] = walkDefinitions(definition, definitions, nextVisitedRefs);
  return {
    schema: merged,
    refName,
  };
};

const normalizeDefinition = (schema, definitions, visitedRefs = new Set()) => {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const { schema: dereferenced, refName } = getResolvedDefinition(
    schema,
    definitions,
    visitedRefs
  );
  if (dereferenced !== schema) {
    return { ...normalizeDefinition(dereferenced, definitions, visitedRefs), __sourceRef: refName };
  }

  if (Array.isArray(dereferenced.allOf)) {
    const merged = {};
    dereferenced.allOf.forEach((branch) => {
      const child = normalizeDefinition(branch, definitions, visitedRefs);
      Object.assign(merged, child);
      if (child.properties && !merged.properties) {
        merged.properties = {};
      }
      if (child.properties) {
        merged.properties = { ...merged.properties, ...child.properties };
      }
      if (child.additionalProperties && !merged.additionalProperties) {
        merged.additionalProperties = child.additionalProperties;
      }
      if (child.patternProperties && !merged.patternProperties) {
        merged.patternProperties = child.patternProperties;
      }
      if (child.required && !merged.required) {
        merged.required = child.required;
      }
      if (child.required) {
        merged.required = Array.from(new Set([...(merged.required || []), ...child.required]));
      }
    });

    return {
      ...merged,
      ...dereferenced,
      ...{ allOf: undefined },
      __sourceRef: merged.__sourceRef || dereferenced.__sourceRef,
    };
  }

  if (Array.isArray(dereferenced.oneOf)) {
    return {
      ...dereferenced,
      oneOf: dereferenced.oneOf.map((branch) =>
        normalizeDefinition(branch, definitions, visitedRefs)
      ),
      __sourceRef: dereferenced.__sourceRef,
    };
  }

  if (Array.isArray(dereferenced.anyOf)) {
    return {
      ...dereferenced,
      anyOf: dereferenced.anyOf.map((branch) =>
        normalizeDefinition(branch, definitions, visitedRefs)
      ),
      __sourceRef: dereferenced.__sourceRef,
    };
  }

  return { ...dereferenced, __sourceRef: dereferenced.__sourceRef };
};

const walkDefinitions = (schema, definitions, visitedRefs = new Set()) => {
  const nodes = [];
  const normalized = normalizeDefinition(schema, definitions, visitedRefs);

  if (!isObject(normalized)) {
    return [normalized];
  }

  nodes.push(normalized);

  if (Array.isArray(normalized.allOf)) {
    normalized.allOf.forEach((branch) => {
      nodes.push(...walkDefinitions(branch, definitions, visitedRefs));
    });
  }

  return nodes;
};

const getEnumSignature = (schema) =>
  Array.isArray(schema?.enum) ? schema.enum.map((value) => String(value)).join(' | ') : null;

const mapBranchTypeLabel = (schema, context) => {
  if (schema?.properties && typeof schema.properties === 'object') {
    const parts = Object.entries(schema.properties).map(([segment, child]) => {
      const childNormalized = normalizeDefinition(child, context.definitions);
      const childType =
        childNormalized?.type === 'object' && childNormalized?.properties
          ? mapBranchTypeLabel(childNormalized, context)
          : getTypeLabel(childNormalized, context);
      return `${segment} = ${childType}`;
    });
    return `{ ${parts.join(', ')} }`;
  }

  return getTypeLabel(schema, context);
};

const getTypeLabel = (schema, context) => {
  const normalized = normalizeDefinition(schema, context.definitions);
  if (!normalized || typeof normalized !== 'object') {
    return 'value';
  }

  if (Array.isArray(normalized.oneOf) || Array.isArray(normalized.anyOf)) {
    const branches = (normalized.oneOf || normalized.anyOf || []).map((branch) =>
      getTypeLabel(branch, context)
    );
    const unique = [...new Set(branches)].filter(Boolean);
    return unique.length === 1 ? unique[0] : unique.join(' | ');
  }

  if (
    typeof normalized.__sourceRef === 'string' &&
    normalized.__sourceRef === 'AbsolutePathBuf'
  ) {
    return 'string (path)';
  }

  if (Array.isArray(normalized.enum)) {
    const enumLabel = getEnumSignature(normalized);
    if (enumLabel) {
      return enumLabel;
    }
  }

  if (Array.isArray(normalized.type)) {
    if (normalized.type.length === 1) {
      return String(normalized.type[0]);
    }
  }

  const normalizedType = String(normalized.type || '').trim();
  if (normalizedType === 'array') {
    return `array<${getTypeLabel(normalized.items || { type: 'string' }, context)}>`;
  }

  if (normalizedType === 'object') {
    if (normalized.additionalProperties && normalized.type === 'object') {
      return `map<${getTypeLabel(normalized.additionalProperties, context)}>`;
    }
    return 'table';
  }

  if (isPrimitiveValue(normalizedType)) {
    return normalizedType;
  }

  const enumLabel = getEnumSignature(normalized);
  if (enumLabel) {
    return enumLabel;
  }

  if (typeof normalized.type === 'string' && normalized.type.length > 0) {
    return normalized.type;
  }

  return 'value';
};

const toMapType = (valueSchema, context) => {
  const valueType = getTypeLabel(valueSchema, context);
  return `map<${valueType}>`;
};

const mergeEnumValues = (base = [], added = []) => {
  const next = [...base];
  const seen = new Set(base.map(String));

  added.forEach((value) => {
    const text = String(value ?? '');
    if (!seen.has(text)) {
      next.push(text);
      seen.add(text);
    }
  });

  return next;
};

const mergeOptionType = (current, next) => {
  if (!current) {
    return next;
  }
  if (current === next) {
    return current;
  }

  if (current.includes(next) || next.includes(current)) {
    return current;
  }

  return `${current} | ${next}`;
};

const addReferenceOption = (optionsByKey, pathSegments, schema, context = {}, overrides = {}) => {
  const normalizedPath = normalizeSegments(pathSegments);
  const key = normalizedPath.join('.');
  if (!key) {
    return;
  }

  const description = String(schema?.description || '').trim();
  const typeLabel = overrides.type || getTypeLabel(schema, context);
  const existing = optionsByKey.get(key);
  const enumValues = Array.isArray(schema?.enum)
    ? schema.enum.map((value) => String(value))
    : [];

  if (!existing) {
    optionsByKey.set(key, {
      key,
      key_path: normalizedPath,
      type: typeLabel,
      enum_values: enumValues,
      enumValues: enumValues,
      description,
      deprecated: schema?.deprecated === true,
    });
    return;
  }

  existing.type = mergeOptionType(existing.type, typeLabel);
  existing.enum_values = mergeEnumValues(existing.enum_values, enumValues);
  existing.enumValues = mergeEnumValues(existing.enumValues, enumValues);
  if (!existing.description && description) {
    existing.description = description;
  }
};

const collectSchemaOptions = (schema, pathSegments, optionsByKey, context) => {
  const normalized = normalizeDefinition(schema, context.definitions);
  if (!normalized || typeof normalized !== 'object') {
    return;
  }

  const normalizedPath = normalizeSegments(pathSegments);
  if (Array.isArray(normalized.allOf) && normalized.allOf.length > 1) {
    return;
  }

  if (Array.isArray(normalized.oneOf)) {
    const branchSchemas = normalized.oneOf.map((branch) =>
      normalizeDefinition(branch, context.definitions)
    );
    const scalarBranches = branchSchemas.filter(isScalarLikeReference);
    const objectBranches = branchSchemas.filter(isObjectLikeReference);

    if (scalarBranches.length > 0 && objectBranches.length > 0) {
      const scalarTypeLabel = getOneOfTypeLabel(scalarBranches, context);
      const scalarEnumValues = scalarBranches.flatMap((branch) =>
        Array.isArray(branch.enum) ? branch.enum : []
      );
      if (normalizedPath.length > 0) {
        const scalarSchema = {
          ...normalized,
          enum: scalarEnumValues,
          type: scalarTypeLabel,
        };
        addReferenceOption(
          optionsByKey,
          normalizedPath,
          scalarSchema,
          context,
          { type: scalarTypeLabel }
        );
      }

      return;
    }

    const branchDescriptions = branchSchemas.map((branch) => {
      if (branch?.type === 'object' && branch?.properties) {
        return mapBranchTypeLabel(branch, context);
      }
      return getTypeLabel(branch, context);
    });
    const unique = [...new Set(branchDescriptions)];
    if (normalizedPath.length > 0) {
      const typeLabel = unique.length === 1 ? unique[0] : unique.join(' | ');
      const scalarEnumValues = branchSchemas
        .flatMap((branch) => (Array.isArray(branch.enum) ? branch.enum : []))
        .filter(
          (value, index, values) =>
            values.findIndex((item) => Object.is(item, value)) === index
        );

      addReferenceOption(
        optionsByKey,
        normalizedPath,
        {
          ...normalized,
          ...(scalarEnumValues.length > 0 ? { enum: scalarEnumValues } : {}),
        },
        context,
        { type: typeLabel }
      );
    }

    normalized.oneOf.forEach((branch) => {
      const branchNormalized = normalizeDefinition(branch, context.definitions);
      if (branchNormalized?.properties) {
        Object.entries(branchNormalized.properties).forEach(([segment, value]) => {
          collectSchemaOptions(value, [...normalizedPath, segment], optionsByKey, context);
        });
      }
    });
    return;
  }

  if (normalized.type === 'array') {
    if (!normalized.items) {
      addReferenceOption(optionsByKey, normalizedPath, { ...normalized, type: 'array<string>' }, context);
      return;
    }

    const itemType = normalizeDefinition(normalized.items, context.definitions);
    if (
      itemType &&
      (itemType.type === 'object' ||
        itemType.properties ||
        itemType.additionalProperties ||
        itemType.oneOf ||
        itemType.allOf)
    ) {
      const itemPath = [...normalizedPath, '<index>'];
      if (itemType.properties) {
        Object.entries(itemType.properties).forEach(([segment, value]) => {
          collectSchemaOptions(value, [...itemPath, segment], optionsByKey, context);
        });
      }
      if (itemType.additionalProperties && itemType.properties) {
        const placeholder = getPlaceholderForSegment(itemPath[itemPath.length - 1], '<index>');
        collectSchemaOptions(
          itemType.additionalProperties,
          [...itemPath, placeholder],
          optionsByKey,
          context
        );
      }
      addReferenceOption(optionsByKey, normalizedPath, { ...normalized }, context);
      return;
    }

    addReferenceOption(
      optionsByKey,
      normalizedPath,
      { ...normalized, type: `array<${getTypeLabel(itemType, context)}>` },
      context
    );
    return;
  }

  if (normalized.type === 'object' || !normalized.type) {
    const properties = normalized.properties || {};
    const hasProperties = Object.keys(properties).length > 0;
    const hasAdditionalProperties =
      normalized.additionalProperties && typeof normalized.additionalProperties === 'object';
    const hasPatternProperties =
      normalized.patternProperties && typeof normalized.patternProperties === 'object';
    if (!hasProperties && (hasAdditionalProperties || hasPatternProperties)) {
      if (hasAdditionalProperties) {
        const placeholder = getPlaceholderForSegment(
          normalizedPath[normalizedPath.length - 1],
          '<name>'
        );
        const additionalProperties = normalizeDefinition(
          normalized.additionalProperties,
          context.definitions
        );
        const additionalHasChildren =
          additionalProperties?.type === 'object' &&
          (Object.keys(additionalProperties.properties || {}).length > 0 ||
            typeof additionalProperties.additionalProperties === 'object');

        if (additionalHasChildren) {
          collectSchemaOptions(
            additionalProperties,
            [...normalizedPath, placeholder],
            optionsByKey,
            context
          );
        } else {
          const mapType = toMapType(additionalProperties, context);
          addReferenceOption(
            optionsByKey,
            normalizedPath,
            { ...normalized, type: mapType },
            context
          );
        }
      } else {
        addReferenceOption(optionsByKey, normalizedPath, { ...normalized }, context);
      }
      return;
    }

    Object.entries(properties).forEach(([segment, child]) => {
      collectSchemaOptions(child, [...normalizedPath, segment], optionsByKey, context);
    });

    if (hasAdditionalProperties) {
      const placeholder = getPlaceholderForSegment(
        normalizedPath[normalizedPath.length - 1],
        '<index>'
      );
      const normalizedAdditional = normalizeDefinition(
        normalized.additionalProperties,
        context.definitions
      );

      if (normalizedAdditional?.properties || normalizedAdditional?.type === 'object') {
        Object.keys(normalizedAdditional.properties || {}).forEach((segment) => {
          collectSchemaOptions(
            normalizedAdditional.properties[segment],
            [...normalizedPath, placeholder, segment],
            optionsByKey,
            context
          );
        });
      } else if (normalizedAdditional?.type === 'object') {
        collectSchemaOptions(
          { ...normalizedAdditional, type: 'object' },
          [...normalizedPath, placeholder],
          optionsByKey,
          context
        );
      } else {
        const mapType = getTypeLabel(normalizedAdditional, context);
        addReferenceOption(
          optionsByKey,
          [...normalizedPath, placeholder],
          { ...normalizedAdditional, type: mapType },
          context
        );
      }
    }

    if (hasPatternProperties) {
      const patternEntries = Object.entries(normalized.patternProperties);
      patternEntries.forEach(([pattern, child]) => {
        const childType = normalizeDefinition(child, context.definitions);
        if (childType?.type === 'object' || childType?.properties) {
          collectSchemaOptions(childType, [...normalizedPath, `<${pattern}>`], optionsByKey, context);
        } else {
          const mapType = getTypeLabel(childType, context);
          addReferenceOption(
            optionsByKey,
            [...normalizedPath, `<${pattern}>`],
            { ...childType, type: mapType },
            context
          );
        }
      });
    }

    return;
  }

  if (normalizedPath.length > 0) {
    addReferenceOption(optionsByKey, normalizedPath, normalized, context);
  }
};

const buildReferenceOptions = (schema) => {
  const definitions = new Map(Object.entries(schema?.definitions || {}));
  const normalizedSchema = normalizeDefinition(schema, definitions);
  if (!isObject(normalizedSchema)) {
    return [];
  }

  const optionsByKey = new Map();

  collectSchemaOptions(normalizedSchema, [], optionsByKey, { definitions });

  const options = [...optionsByKey.values()].sort((left, right) =>
    left.key.localeCompare(right.key)
  );

  options.forEach((option) => {
    option.top_level = option.key_path[0];
    option.enum_values = option.enum_values || [];
    option.enumValues = option.enumValues || option.enum_values || [];
    option.keyPath = option.key_path;
  });

  return options;
};

const mapTypeToKind = (type) => {
  const normalizedType = normalizeType(type);

  if (normalizedType === 'table') {
    return 'table';
  }

  if (normalizedType.startsWith('array<')) {
    return 'array';
  }

  return 'value';
};

const getContainerKind = (path, depth) => {
  const nextSegment = path[depth + 1];

  if (nextSegment === '<index>' || String(nextSegment).endsWith('[]')) {
    return 'array';
  }

  return 'table';
};

const pathPrefixMatches = (referencePath, actualPrefix) => {
  if (referencePath.length < actualPrefix.length) {
    return false;
  }

  for (let index = 0; index < actualPrefix.length; index += 1) {
    const referenceSegment = referencePath[index];
    const actualSegment = actualPrefix[index];

    if (isPlaceholderSegment(referenceSegment)) {
      continue;
    }

    if (referenceSegment !== actualSegment) {
      return false;
    }
  }

  return true;
};

const fullPathMatches = (referencePath, actualPath) =>
  referencePath.length === actualPath.length &&
  pathPrefixMatches(referencePath, actualPath);

const countConcreteSegments = (segments) =>
  segments.reduce((count, segment) => count + (isPlaceholderSegment(segment) ? 0 : 1), 0);

const referenceOptions = buildReferenceOptions(CONFIG_SCHEMA_DATA);

const optionsByKey = new Map(referenceOptions.map((option) => [option.key, option]));

const mergeDefinition = (map, definition) => {
  const existing = map.get(definition.key);
  if (!existing) {
    map.set(definition.key, definition);
    return;
  }

  const existingPriority = KIND_PRIORITY[existing.kind] || 0;
  const nextPriority = KIND_PRIORITY[definition.kind] || 0;

  map.set(definition.key, {
    ...existing,
    kind: nextPriority > existingPriority ? definition.kind : existing.kind,
    isDeprecated: Boolean(existing.isDeprecated || definition.isDeprecated),
  });
};

export const getReferenceOptionForPath = (pathSegments) => {
  const normalizedPath = normalizeSegments(pathSegments);
  if (normalizedPath.length === 0) {
    return null;
  }

  const exactKey = normalizedPath.join('.');
  const exactMatch = optionsByKey.get(exactKey);
  if (exactMatch) {
    return exactMatch;
  }

  const candidates = referenceOptions.filter((option) => fullPathMatches(option.keyPath, normalizedPath));
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const concreteDelta = countConcreteSegments(right.keyPath) - countConcreteSegments(left.keyPath);
    if (concreteDelta !== 0) {
      return concreteDelta;
    }

    return left.key.localeCompare(right.key);
  });

  return candidates[0];
};

export const getReferenceTableDefinitions = (pathSegments = []) => {
  const normalizedPath = normalizeSegments(pathSegments);
  const childDefinitions = new Map();
  const depth = normalizedPath.length;

  referenceOptions.forEach((option) => {
    if (!pathPrefixMatches(option.keyPath, normalizedPath)) {
      return;
    }

    if (option.keyPath.length <= depth) {
      return;
    }

    const childKey = option.keyPath[depth];
    if (isPlaceholderSegment(childKey)) {
      return;
    }

    const isLeaf = option.keyPath.length === depth + 1;
    const kind = isLeaf ? mapTypeToKind(option.type) : getContainerKind(option.keyPath, depth);

    mergeDefinition(childDefinitions, {
      key: childKey,
      kind,
      isDeprecated: isLeaf ? option.deprecated : false,
    });
  });

  return [...childDefinitions.values()].sort((left, right) => left.key.localeCompare(right.key));
};

export const getReferenceRootDefinitions = () => getReferenceTableDefinitions([]);

const featureKeys = [
  ...new Set(
    referenceOptions
      .filter(
        (option) =>
          option.keyPath.length === 2 &&
          option.keyPath[0] === 'features' &&
          !isPlaceholderSegment(option.keyPath[1])
      )
      .map((option) => option.keyPath[1])
  ),
].sort((left, right) => left.localeCompare(right));

export const getReferenceFeatureKeys = () => featureKeys;

export const getReferenceCustomIdPlaceholder = (pathSegments = []) => {
  const normalizedPath = normalizeSegments(pathSegments);
  const depth = normalizedPath.length;
  const placeholders = new Set();

  referenceOptions.forEach((option) => {
    if (!pathPrefixMatches(option.keyPath, normalizedPath)) {
      return;
    }

    if (option.keyPath.length <= depth) {
      return;
    }

    const childKey = option.keyPath[depth];
    if (isCustomIdPlaceholder(childKey)) {
      placeholders.add(childKey);
    }
  });

  const [firstMatch] = [...placeholders];
  return firstMatch || null;
};

export const getReferenceDescendantOptions = (pathSegments = []) => {
  const normalizedPath = normalizeSegments(pathSegments);

  return referenceOptions
    .filter(
      (option) =>
        pathPrefixMatches(option.keyPath, normalizedPath) &&
        option.keyPath.length > normalizedPath.length
    )
    .sort((left, right) => left.keyPath.length - right.keyPath.length || left.key.localeCompare(right.key));
};
