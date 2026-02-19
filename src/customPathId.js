import os from 'os';
import path from 'path';

const normalizePathSegments = (value) =>
  String(value || '')
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0)
    .join(path.sep);

const resolveCustomPath = (value, homePath) => {
  const withoutTilde = value.startsWith('~') ? value.slice(1) : value;
  const relativePath = normalizePathSegments(withoutTilde.replace(/^[/\\]+/, ''));
  return path.resolve(homePath, relativePath);
};

const isWithinHomePath = (resolvedPath, homePath) => {
  const relative = path.relative(homePath, resolvedPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export const normalizeCustomPathId = (value, homePath = os.homedir()) => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) {
    return {
      ok: false,
      error: 'ID cannot be empty.',
    };
  }

  const resolvedPath = resolveCustomPath(trimmedValue, homePath);
  if (!isWithinHomePath(resolvedPath, homePath)) {
    return {
      ok: false,
      error: `Path must stay inside ${homePath}.`,
    };
  }

  return {
    ok: true,
    value: resolvedPath,
  };
};
