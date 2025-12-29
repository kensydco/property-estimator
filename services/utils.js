export function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

export function buildErrorFlags(primary = [], secondary = []) {
  return [...new Set([...(primary || []), ...(secondary || [])])].filter(Boolean);
}

export function toNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeServices(services) {
  if (!Array.isArray(services)) return [];
  return services.map((service) => service.trim()).filter(Boolean);
}
