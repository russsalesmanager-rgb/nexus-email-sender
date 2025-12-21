/**
 * Global middleware for all /api/* routes
 * Handles CORS, security headers, and authentication
 */

import { handleOptions, getCorsHeaders, getSecurityHeaders, getCookie, errorResponse } from '../utils.js';
import { validateSession } from '../session.js';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
    '/api/health',
    '/api/auth/signup',
    '/api/auth/login'
];

export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Get origin for CORS
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.APP_ORIGIN || '*';
    
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
        return handleOptions(request, allowedOrigin);
    }
    
    // Check if route requires authentication
    const isPublicRoute = PUBLIC_ROUTES.some(route => path.startsWith(route));
    
    if (!isPublicRoute) {
        // Validate session
        const token = getCookie(request, 'nxsess');
        const user = await validateSession(env.DB, token);
        
        if (!user) {
            return errorResponse('Authentication required', 401);
        }
        
        // Attach user to context for downstream handlers
        context.data = { user };
    }
    
    // Continue to next handler
    const response = await next();
    
    // Add CORS and security headers to response
    const corsHeaders = getCorsHeaders(origin, allowedOrigin);
    const securityHeaders = getSecurityHeaders();
    
    Object.entries({ ...corsHeaders, ...securityHeaders }).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    
    return response;
}
