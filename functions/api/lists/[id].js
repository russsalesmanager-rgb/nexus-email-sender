// GET/PUT/DELETE /api/lists/[id] - Get, update, or delete list

import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { requireAuth } from '../../lib/auth.js';
import { sanitize, logEvent } from '../../lib/db.js';

// GET - Get single list with members
export async function onRequestGet(context) {
    const { request, env, params } = context;
    
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
        
        const list = await env.DB.prepare(`
            SELECT id, name, created_at
            FROM lists
            WHERE id = ? AND user_id = ?
        `).bind(params.id, user.id).first();
        
        if (!list) {
            return addCorsHeaders(
                addSecurityHeaders(notFoundResponse('List not found')),
                env.APP_ORIGIN
            );
        }
        
        // Get member count
        const { count } = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM list_members WHERE list_id = ?'
        ).bind(params.id).first();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse({ ...list, member_count: count || 0 })),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Get list error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to get list', 500)),
            env.APP_ORIGIN
        );
    }
}

// PUT - Update list
export async function onRequestPut(context) {
    const { request, env, params } = context;
    
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
        
        const list = await env.DB.prepare(
            'SELECT id FROM lists WHERE id = ? AND user_id = ?'
        ).bind(params.id, user.id).first();
        
        if (!list) {
            return addCorsHeaders(
                addSecurityHeaders(notFoundResponse('List not found')),
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
        
        await env.DB.prepare(
            'UPDATE lists SET name = ? WHERE id = ? AND user_id = ?'
        ).bind(name, params.id, user.id).run();
        
        await logEvent(env.DB, user.id, 'list.updated', { listId: params.id });
        
        const updated = await env.DB.prepare(
            'SELECT id, name, created_at FROM lists WHERE id = ?'
        ).bind(params.id).first();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse(updated)),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Update list error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to update list', 500)),
            env.APP_ORIGIN
        );
    }
}

// DELETE - Delete list
export async function onRequestDelete(context) {
    const { request, env, params } = context;
    
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
        
        const list = await env.DB.prepare(
            'SELECT id, name FROM lists WHERE id = ? AND user_id = ?'
        ).bind(params.id, user.id).first();
        
        if (!list) {
            return addCorsHeaders(
                addSecurityHeaders(notFoundResponse('List not found')),
                env.APP_ORIGIN
            );
        }
        
        await env.DB.prepare(
            'DELETE FROM lists WHERE id = ? AND user_id = ?'
        ).bind(params.id, user.id).run();
        
        await logEvent(env.DB, user.id, 'list.deleted', { listId: params.id, name: list.name });
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse({ message: 'List deleted successfully' })),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Delete list error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to delete list', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
