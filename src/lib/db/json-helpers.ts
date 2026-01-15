/**
 * JSON serialization helpers for SQLite storage
 * SQLite stores JSON as strings, so we need to parse/stringify
 */

/**
 * Parse a JSON string to an array, returning empty array on failure
 */
export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Stringify an array to JSON string
 */
export function stringifyJsonArray<T>(arr: T[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return "[]";
  return JSON.stringify(arr);
}

/**
 * Parse a JSON string to an object, returning undefined on failure
 */
export function parseJsonObject<T extends object>(
  value: string | null | undefined
): T | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Stringify an object to JSON string, returning null if undefined/null
 */
export function stringifyJsonObject<T extends object>(
  obj: T | null | undefined
): string | null {
  if (!obj) return null;
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

/**
 * Safe boolean parsing for SQLite (handles "true"/"false" strings)
 */
export function parseBoolean(value: string | boolean | null | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}
