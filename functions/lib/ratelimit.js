// Rate limiting utilities using Cloudflare KV

// Check rate limit
export async function checkRateLimit(kv, key, limit, windowSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${key}:${Math.floor(now / windowSeconds)}`;
    
    const current = await kv.get(windowKey);
    const count = current ? parseInt(current) : 0;
    
    if (count >= limit) {
        return { allowed: false, remaining: 0, resetAt: (Math.floor(now / windowSeconds) + 1) * windowSeconds };
    }
    
    await kv.put(windowKey, (count + 1).toString(), { expirationTtl: windowSeconds * 2 });
    
    return { allowed: true, remaining: limit - count - 1, resetAt: (Math.floor(now / windowSeconds) + 1) * windowSeconds };
}

// Rate limit by IP
export async function rateLimitByIP(request, kv, limit = 30, windowSeconds = 3600) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `ratelimit:ip:${ip}`;
    
    return await checkRateLimit(kv, key, limit, windowSeconds);
}

// Rate limit by user
export async function rateLimitByUser(userId, kv, limit = 100, windowSeconds = 3600) {
    const key = `ratelimit:user:${userId}`;
    
    return await checkRateLimit(kv, key, limit, windowSeconds);
}

// Verify Cloudflare Turnstile token
export async function verifyTurnstile(token, secret, ip) {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);
    
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return false;
    }
}
