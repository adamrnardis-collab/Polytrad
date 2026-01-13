// Wrap all JSON operations with error handling

/**
 * Safe JSON stringify with error handling
 */
export function safeStringify(obj: any, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    console.error('JSON.stringify failed:', error);
    return fallback;
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('JSON.parse failed:', error);
    return fallback;
  }
}
