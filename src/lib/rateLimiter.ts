// Rate Limiter - IP-based rate limiting to prevent abuse

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry>;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(maxRequests: number = 10, windowMs: number = 3600000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - IP address or session identifier
   * @returns {boolean} true if request should be allowed
   */
  checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry) {
      // First request from this identifier
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // Check if the window has expired
    if (now > entry.resetTime) {
      // Reset the counter
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // Within the window
    if (entry.count >= this.maxRequests) {
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemainingRequests(identifier: string): number {
    const entry = this.requests.get(identifier);
    if (!entry) {
      return this.maxRequests;
    }

    const now = Date.now();
    if (now > entry.resetTime) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - entry.count);
  }

  /**
   * Get time until reset for an identifier (in seconds)
   */
  getTimeUntilReset(identifier: string): number {
    const entry = this.requests.get(identifier);
    if (!entry) {
      return 0;
    }

    const now = Date.now();
    if (now > entry.resetTime) {
      return 0;
    }

    return Math.ceil((entry.resetTime - now) / 1000);
  }

  /**
   * Cleanup expired entries periodically
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.requests.entries()) {
        if (now > entry.resetTime) {
          this.requests.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Stop cleanup interval (useful for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.requests.clear();
  }
}

// Singleton instance
const rateLimitPerHour = parseInt(process.env.RATE_LIMIT_PER_HOUR || '10', 10);
export const rateLimiter = new RateLimiter(rateLimitPerHour, 3600000);

/**
 * Extract IP address from request headers
 */
export function getClientIP(headers: Headers): string {
  // Check common headers for client IP (in order of preference)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the list
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback to a default identifier
  return 'unknown';
}

/**
 * Middleware helper for rate limiting
 */
export function checkRateLimit(headers: Headers): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const clientIP = getClientIP(headers);
  const allowed = rateLimiter.checkRateLimit(clientIP);
  const remaining = rateLimiter.getRemainingRequests(clientIP);
  const resetTime = rateLimiter.getTimeUntilReset(clientIP);

  return { allowed, remaining, resetTime };
}
