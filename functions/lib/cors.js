// CORS utilities for handling cross-origin requests

export function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

export function handleCors(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.APP_ORIGIN || origin || '*';
    
    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders(allowedOrigin),
        });
    }
    
    return null; // Not a preflight request
}

export function addCorsHeaders(response, origin) {
    const newResponse = new Response(response.body, response);
    const headers = corsHeaders(origin);
    
    Object.entries(headers).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
    });
    
    return newResponse;
}

export function addSecurityHeaders(response) {
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return newResponse;
}
