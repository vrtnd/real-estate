import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, object>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour default
});

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCache(key: string, value: object, ttl?: number): void {
  cache.set(key, value, { ttl });
}

export function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.sort().join(",") : v}`)
    .join("&");
  return `${prefix}:${sorted}`;
}
