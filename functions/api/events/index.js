// GET /api/events - List recent events for auditing

import { jsonResponse, errorResponse, unauthorizedResponse } from '../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../lib/cors.js';
import { requireAuth } from '../lib/auth.js';
import { paginationParams } from '../lib/db.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;
    
    try {
        const { authorized, user } = await requireAuth(request, env);
        if (!authorized) {
            return addCorsHeaders(
                addSecurityHeaders(unauthorizedResponse()),
                env.APP_ORIGIN
            );
        }
        
        const { limit, offset } = paginationParams(request.url);
        
        const { results } = await env.DB.prepare(`
            SELECT id, type, payload_json, created_at
            FROM events
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).bind(user.id, limit, offset).all();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse(results || [])),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('List events error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to list events', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
