// GET/PUT/DELETE /api/contacts/[id] - Get, update, or delete contact

import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { requireAuth } from '../../lib/auth.js';
import { isValidEmail, sanitize, logEvent } from '../../lib/db.js';

// GET - Get single contact
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
        
        const contact = await env.DB.prepare(`
            SELECT id, email, first_name, last_name, tags_json, created_at
            FROM contacts
            WHERE id = ? AND user_id = ?
        `).bind(params.id, user.id).first();
        
        if (!contact) {
            return addCorsHeaders(
                addSecurityHeaders(notFoundResponse('Contact not found')),
                env.APP_ORIGIN
            );
        }
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse(contact)),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Get contact error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to get contact', 500)),
            env.APP_ORIGIN
        );
    }
}

// PUT - Update contact
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
        
        const contact = await env.DB.prepare(
            'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
        ).bind(params.id, user.id).first();
        
        if (!contact) {
            return addCorsHeaders(
                addSecurityHeaders(notFoundResponse('Contact not found')),
                env.APP_ORIGIN
            );
        }
        
        const body = await request.json();
        const email = sanitize(body.email)?.toLowerCase();
        const firstName = sanitize(body.first_name) || '';
        const lastName = sanitize(body.last_name) || '';
        const tagsJson = JSON.stringify(body.tags_json || []);
        
        if (!email || !isValidEmail(email)) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Valid email is required')),
                env.APP_ORIGIN
            );
        }
        
        await env.DB.prepare(`
            UPDATE contacts
            SET email = ?, first_name = ?, last_name = ?, tags_json = ?
            WHERE id = ? AND user_id = ?
        `).bind(email, firstName, lastName, tagsJson, params.id, user.id).run();
        
        await logEvent(env.DB, user.id, 'contact.updated', { contactId: params.id });
        
        const updated = await env.DB.prepare(
            'SELECT id, email, first_name, last_name, tags_json, created_at FROM contacts WHERE id = ?'
        ).bind(params.id).first();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse(updated)),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Update contact error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to update contact', 500)),
            env.APP_ORIGIN
        );
    }
}

// DELETE - Delete contact
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
        
        const contact = await env.DB.prepare(
            'SELECT id, email FROM contacts WHERE id = ? AND user_id = ?'
        ).bind(params.id, user.id).first();
        
        if (!contact) {
            return addCorsHeaders(
                addSecurityHeaders(notFoundResponse('Contact not found')),
                env.APP_ORIGIN
            );
        }
        
        await env.DB.prepare(
            'DELETE FROM contacts WHERE id = ? AND user_id = ?'
        ).bind(params.id, user.id).run();
        
        await logEvent(env.DB, user.id, 'contact.deleted', { contactId: params.id, email: contact.email });
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse({ message: 'Contact deleted successfully' })),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Delete contact error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to delete contact', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
