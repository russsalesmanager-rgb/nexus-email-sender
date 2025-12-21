// GET /api/auth/me - Get current authenticated user

import { jsonResponse, errorResponse, unauthorizedResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { requireAuth } from '../../lib/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    
    // Handle CORS preflight
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;
    
    try {
        // Check authentication
        const { authorized, user } = await requireAuth(request, env);
        
        if (!authorized || !user) {
            return addCorsHeaders(
                addSecurityHeaders(unauthorizedResponse('Not authenticated')),
                env.APP_ORIGIN
            );
        }
        
        // Return user data
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse({ user })),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Auth check error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to check authentication', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
