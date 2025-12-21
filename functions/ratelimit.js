/**
 * Rate limiting utilities using Cloudflare KV
 * Implements sliding window rate limiting
 */

/**
 * Check and increment rate limit for a key
 * @param {KVNamespace} kv - KV namespace
 * @param {string} key - Rate limit key (e.g., 'user:123' or 'ip:1.2.3.4')
 * @param {number} limit - Maximum requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function checkRateLimit(kv, key, limit, windowSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
    
    // Get current count
    const currentCount = await kv.get(windowKey);
    const count = currentCount ? parseInt(currentCount) : 0;
    
    if (count >= limit) {
        // Rate limit exceeded
        const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;
        return {
            allowed: false,
            remaining: 0,
            resetAt
        };
    }
    
    // Increment counter
    const newCount = count + 1;
    await kv.put(windowKey, newCount.toString(), {
        expirationTtl: windowSeconds * 2 // Keep for 2 windows for safety
    });
    
    const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;
    
    return {
        allowed: true,
        remaining: limit - newCount,
        resetAt
    };
}

/**
 * Check user rate limit
 * @param {KVNamespace} kv
 * @param {string} userId
 * @param {number} limit - Default 200 per day
 * @returns {Promise<object>}
 */
export async function checkUserRateLimit(kv, userId, limit = 200) {
    const windowSeconds = 24 * 60 * 60; // 24 hours
    return checkRateLimit(kv, `user:${userId}`, limit, windowSeconds);
}

/**
 * Check IP rate limit
 * @param {KVNamespace} kv
 * @param {string} ip
 * @param {number} limit - Default 30 per hour
 * @returns {Promise<object>}
 */
export async function checkIPRateLimit(kv, ip, limit = 30) {
    const windowSeconds = 60 * 60; // 1 hour
    return checkRateLimit(kv, `ip:${ip}`, limit, windowSeconds);
}

/**
 * Get client IP from request
 * @param {Request} request
 * @returns {string}
 */
export function getClientIP(request) {
    // Cloudflare provides the client IP in CF-Connecting-IP header
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] ||
           '0.0.0.0';
}
