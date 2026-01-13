// Simple in-memory cache for generated prompts
// Reduces API costs for repeated URLs

import type { GenerationResult, ExtractedContent, UserGoal } from './types';
import crypto from 'crypto';

interface CacheEntry {
  result: GenerationResult;
  timestamp: number;
}

// In-memory cache (use Redis/KV in production)
const cache = new Map<string, CacheEntry>();

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600000', 10); // 1 hour default
const MAX_CACHE_SIZE = parseInt(process.env.MAX_CACHE_SIZE || '100', 10);
const ENABLE_CACHE = process.env.ENABLE_CACHE !== 'false';

/**
 * Generate cache key from content and goal
 */
function generateCacheKey(content: ExtractedContent, goal: UserGoal, customGoal?: string): string {
  const data = {
    title: content.title,
    headingsCount: content.headings.length,
    structureHash: JSON.stringify(content.structure),
    goal,
    customGoal,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Get cached result if available and not expired
 */
export function getCached(
  content: ExtractedContent,
  goal: UserGoal,
  customGoal?: string
): GenerationResult | null {
  if (!ENABLE_CACHE) return null;

  const key = generateCacheKey(content, goal, customGoal);
  const entry = cache.get(key);

  if (!entry) return null;

  // Check if expired
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  console.log(`Cache HIT for key: ${key.substring(0, 12)}... (saved ~$0.12)`);
  return entry.result;
}

/**
 * Store result in cache
 */
export function setCached(
  content: ExtractedContent,
  goal: UserGoal,
  result: GenerationResult,
  customGoal?: string
): void {
  if (!ENABLE_CACHE) return;

  const key = generateCacheKey(content, goal, customGoal);

  // Evict oldest entry if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    cache.delete(oldestKey);
    console.log(`Cache EVICT: ${oldestKey.substring(0, 12)}...`);
  }

  cache.set(key, {
    result,
    timestamp: Date.now(),
  });

  console.log(`Cache SET for key: ${key.substring(0, 12)}... (${cache.size}/${MAX_CACHE_SIZE})`);
}

/**
 * Clear expired entries (call periodically)
 */
export function clearExpired(): number {
  if (!ENABLE_CACHE) return 0;

  let cleared = 0;
  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`Cache CLEAR: removed ${cleared} expired entries`);
  }

  return cleared;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL,
    enabled: ENABLE_CACHE,
  };
}

// Auto-clear expired entries every 10 minutes
if (ENABLE_CACHE) {
  setInterval(clearExpired, 600000);
}
