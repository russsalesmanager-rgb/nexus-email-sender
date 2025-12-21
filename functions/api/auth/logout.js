// POST /api/auth/logout - End user session

import { jsonResponse, errorResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { getSessionToken, deleteSession, deleteSessionCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Handle CORS preflight
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;
    
    try {
        // Get session token from cookie
        const token = getSessionToken(request);
        
        if (token) {
            // Delete session from database
            await deleteSession(env.DB, token);
        }
        
        // Return success with cookie deletion
        const response = jsonResponse({ message: 'Logged out successfully' });
        response.headers.set('Set-Cookie', deleteSessionCookie());
        
        return addCorsHeaders(addSecurityHeaders(response), env.APP_ORIGIN);
        
    } catch (error) {
        console.error('Logout error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Logout failed', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
