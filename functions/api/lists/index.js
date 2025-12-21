// GET/POST /api/lists - List or create lists

import { jsonResponse, errorResponse, unauthorizedResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { requireAuth, generateId } from '../../lib/auth.js';
import { sanitize, logEvent, paginationParams } from '../../lib/db.js';

// GET - List all lists
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
            SELECT l.id, l.name, l.created_at,
                   COUNT(lm.contact_id) as member_count
            FROM lists l
            LEFT JOIN list_members lm ON l.id = lm.list_id
            WHERE l.user_id = ?
            GROUP BY l.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `).bind(user.id, limit, offset).all();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse(results || [])),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('List lists error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to list lists', 500)),
            env.APP_ORIGIN
        );
    }
}

// POST - Create list
export async function onRequestPost(context) {
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
        
        const body = await request.json();
        const name = sanitize(body.name);
        
        if (!name) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('List name is required')),
                env.APP_ORIGIN
            );
        }
        
        const listId = generateId();
        await env.DB.prepare(`
            INSERT INTO lists (id, user_id, name)
            VALUES (?, ?, ?)
        `).bind(listId, user.id, name).run();
        
        await logEvent(env.DB, user.id, 'list.created', { listId, name });
        
        const list = await env.DB.prepare(
            'SELECT id, name, created_at FROM lists WHERE id = ?'
        ).bind(listId).first();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse({ ...list, member_count: 0 }, 201)),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Create list error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to create list', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
