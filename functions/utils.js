/**
 * Common utilities for Cloudflare Pages Functions
 */

/**
 * Send a JSON response with appropriate headers
 * @param {object} data - Data to send
 * @param {number} status - HTTP status code
 * @param {object} headers - Additional headers
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...getSecurityHeaders(),
            ...headers
        }
    });
}

/**
 * Send an error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
export function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, status);
}

/**
 * Get security headers
 * @returns {object}
 */
export function getSecurityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
}

/**
 * Get CORS headers
 * @param {string} origin - Request origin
 * @param {string} allowedOrigin - Allowed origin
 * @returns {object}
 */
export function getCorsHeaders(origin, allowedOrigin) {
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };
    
    if (origin === allowedOrigin || allowedOrigin === '*') {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    
    return headers;
}

/**
 * Handle OPTIONS preflight request
 * @param {Request} request
 * @param {string} allowedOrigin
 * @returns {Response}
 */
export function handleOptions(request, allowedOrigin) {
    const origin = request.headers.get('Origin');
    return new Response(null, {
        status: 204,
        headers: {
            ...getCorsHeaders(origin, allowedOrigin),
            ...getSecurityHeaders()
        }
    });
}

/**
 * Parse request body as JSON
 * @param {Request} request
 * @returns {Promise<object>}
 */
export async function parseBody(request) {
    try {
        const contentType = request.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Content-Type must be application/json');
        }
        return await request.json();
    } catch (error) {
        throw new Error('Invalid JSON body');
    }
}

/**
 * Get current Unix timestamp in seconds
 * @returns {number}
 */
export function now() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Get cookie value from request
 * @param {Request} request
 * @param {string} name
 * @returns {string|null}
 */
export function getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        const [key, value] = cookie.split('=');
        if (key === name) {
            return decodeURIComponent(value);
        }
    }
    
    return null;
}

/**
 * Create a Set-Cookie header
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {object} options - Cookie options
 * @returns {string}
 */
export function createCookie(name, value, options = {}) {
    const {
        maxAge = 7 * 24 * 60 * 60, // 7 days
        path = '/',
        httpOnly = true,
        secure = true,
        sameSite = 'Lax'
    } = options;
    
    let cookie = `${name}=${encodeURIComponent(value)}`;
    
    if (maxAge) cookie += `; Max-Age=${maxAge}`;
    if (path) cookie += `; Path=${path}`;
    if (httpOnly) cookie += '; HttpOnly';
    if (secure) cookie += '; Secure';
    if (sameSite) cookie += `; SameSite=${sameSite}`;
    
    return cookie;
}

/**
 * Create a delete cookie header
 * @param {string} name
 * @returns {string}
 */
export function deleteCookie(name) {
    return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
