const toStringArray = (value) =>
  Array.isArray(value) ? value.map((item) => String(item)) : [];

const toObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};

const uniqueScalars = (values) => {
  const seen = new Set();
  const ordered = [];

  values.forEach((value) => {
    const text = String(value);
    if (seen.has(text)) {
      return;
    }

    seen.add(text);
    ordered.push(text);
  });

  return ordered;
};

const normalizeObjectVariant = (variant, index) => ({
  kind: 'object',
  id: String(variant?.id || `object_${index + 1}`),
  label: String(variant?.label || `object_${index + 1}`),
  requiredKeys: toStringArray(variant?.requiredKeys),
  fixedValues: toObject(variant?.fixedValues),
});

const uniquifyPresetLabels = (items) => {
  const seen = new Map();

  return items.map((item) => {
    const baseLabel = String(item.label);
    const occurrence = (seen.get(baseLabel) || 0) + 1;
    seen.set(baseLabel, occurrence);

    if (occurrence === 1) {
      return item;
    }

    return {
      ...item,
      label: `${baseLabel} (${occurrence})`,
    };
  });
};

export const isObjectValue = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

export const objectMatchesVariant = (value, variant) => {
  if (!isObjectValue(value) || !variant || typeof variant !== 'object') {
    return false;
  }

  const fixedValues = toObject(variant.fixedValues);
  const requiredKeys = toStringArray(variant.requiredKeys);
  const fixedPairs = Object.entries(fixedValues);

  if (
    fixedPairs.some(([fixedKey, fixedValue]) => !Object.is(value[fixedKey], fixedValue))
  ) {
    return false;
  }

  return requiredKeys.every((requiredKey) =>
    Object.prototype.hasOwnProperty.call(value, requiredKey)
  );
};

export const buildVariantSelectorOptions = (variantMeta) => {
  if (!variantMeta || variantMeta.kind !== 'scalar_object') {
    return [];
  }

  const scalarOptions = uniqueScalars(toStringArray(variantMeta.scalarOptions));
  const objectVariants = Array.isArray(variantMeta.objectVariants)
    ? variantMeta.objectVariants.map(normalizeObjectVariant)
    : [];

  const rawOptions = [
    ...scalarOptions.map((value) => ({
      kind: 'scalar',
      value,
      label: value,
    })),
    ...objectVariants.map((variant) => ({
      ...variant,
      label: `${variant.label} /`,
    })),
  ];

  return uniquifyPresetLabels(rawOptions);
};

const seedObjectVariant = (currentValue, selectedVariant, resolveDefaultValue) => {
  const seededObject = objectMatchesVariant(currentValue, selectedVariant)
    ? { ...currentValue }
    : {};
  const fixedValues = toObject(selectedVariant.fixedValues);
  const requiredKeys = toStringArray(selectedVariant.requiredKeys);

  Object.entries(fixedValues).forEach(([fixedKey, fixedValue]) => {
    seededObject[String(fixedKey)] = fixedValue;
  });

  requiredKeys.forEach((requiredKey) => {
    if (Object.prototype.hasOwnProperty.call(seededObject, requiredKey)) {
      return;
    }

    seededObject[requiredKey] = resolveDefaultValue(requiredKey);
  });

  return seededObject;
};

const shallowObjectEquals = (left, right) => {
  if (!isObjectValue(left) || !isObjectValue(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(right, key) && Object.is(left[key], right[key])
  );
};

export const applyVariantSelection = ({
  currentValue,
  selectedVariant,
  resolveDefaultValue,
}) => {
  if (!selectedVariant || typeof selectedVariant !== 'object') {
    return {
      changed: false,
      isObjectSelection: false,
      isObjectVariantSwitch: false,
      navigateToObject: false,
      nextValue: currentValue,
    };
  }

  if (selectedVariant.kind === 'object') {
    const resolver = typeof resolveDefaultValue === 'function'
      ? resolveDefaultValue
      : () => ({});
    const nextValue = seedObjectVariant(currentValue, selectedVariant, resolver);
    const isCurrentObjectValue = isObjectValue(currentValue);
    const isObjectVariantSwitch =
      isCurrentObjectValue && !objectMatchesVariant(currentValue, selectedVariant);
    const changed = !shallowObjectEquals(currentValue, nextValue);

    return {
      changed,
      isObjectSelection: true,
      isObjectVariantSwitch,
      navigateToObject: true,
      nextValue,
    };
  }

  const nextScalarValue = String(selectedVariant.value);
  return {
    changed: isObjectValue(currentValue) || !Object.is(currentValue, nextScalarValue),
    isObjectSelection: false,
    isObjectVariantSwitch: false,
    navigateToObject: false,
    nextValue: nextScalarValue,
  };
};

const asPathSegments = (value) =>
  Array.isArray(value) ? [...value] : [];

const isContainerValue = (value) =>
  isObjectValue(value) || Array.isArray(value);

export const resolveObjectVariantNavigationPath = ({
  basePath,
  nextValue,
  preferredKey = null,
}) => {
  const normalizedBasePath = asPathSegments(basePath);
  if (!isObjectValue(nextValue)) {
    return normalizedBasePath;
  }

  const preferredSegment = preferredKey === null ? '' : String(preferredKey);
  if (preferredSegment && Object.prototype.hasOwnProperty.call(nextValue, preferredSegment)) {
    const preferredValue = nextValue[preferredSegment];
    if (isContainerValue(preferredValue)) {
      return [...normalizedBasePath, preferredSegment];
    }
  }

  const nestedContainerKeys = Object.keys(nextValue).filter((key) =>
    isContainerValue(nextValue[key])
  );
  if (nestedContainerKeys.length === 1) {
    return [...normalizedBasePath, nestedContainerKeys[0]];
  }

  return normalizedBasePath;
};

const getTopLevelObjectSegments = (variantMeta) => {
  const fromSchemaPaths = Array.isArray(variantMeta?.objectSchemaPaths)
    ? variantMeta.objectSchemaPaths
      .map((path) => String(path || '').split('.')[0])
      .filter((segment) => segment.length > 0)
    : [];
  const fromRequiredKeys = Array.isArray(variantMeta?.objectVariants)
    ? variantMeta.objectVariants.flatMap((variant) =>
      Array.isArray(variant?.requiredKeys)
        ? variant.requiredKeys.map((key) => String(key))
        : []
    )
    : [];

  return new Set([...fromSchemaPaths, ...fromRequiredKeys]);
};

export const resolveMixedVariantBackNavigationPath = ({
  pathSegments,
  resolveVariantMeta,
}) => {
  const normalizedPath = asPathSegments(pathSegments);
  if (normalizedPath.length < 2 || typeof resolveVariantMeta !== 'function') {
    return null;
  }

  const parentPath = normalizedPath.slice(0, -1);
  const parentKey = String(parentPath[parentPath.length - 1] || '');
  if (!parentKey) {
    return null;
  }

  const basePath = parentPath.slice(0, -1);
  const variantMeta = resolveVariantMeta(basePath, parentKey);
  if (variantMeta?.kind !== 'scalar_object') {
    return null;
  }

  const currentSegment = String(normalizedPath[normalizedPath.length - 1] || '');
  if (!currentSegment) {
    return null;
  }

  const topLevelObjectSegments = getTopLevelObjectSegments(variantMeta);
  if (!topLevelObjectSegments.has(currentSegment)) {
    return null;
  }

  return basePath;
};
