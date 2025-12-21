// GET/POST /api/contacts - List or create contacts

import { jsonResponse, errorResponse, unauthorizedResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { requireAuth, generateId } from '../../lib/auth.js';
import { isValidEmail, sanitize, logEvent, paginationParams } from '../../lib/db.js';

// GET - List contacts
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
            SELECT id, email, first_name, last_name, tags_json, created_at
            FROM contacts
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).bind(user.id, limit, offset).all();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse(results || [])),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('List contacts error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to list contacts', 500)),
            env.APP_ORIGIN
        );
    }
}

// POST - Create contact
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
        
        // Check for duplicate
        const existing = await env.DB.prepare(
            'SELECT id FROM contacts WHERE user_id = ? AND email = ?'
        ).bind(user.id, email).first();
        
        if (existing) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Contact with this email already exists', 409)),
                env.APP_ORIGIN
            );
        }
        
        const contactId = generateId();
        await env.DB.prepare(`
            INSERT INTO contacts (id, user_id, email, first_name, last_name, tags_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(contactId, user.id, email, firstName, lastName, tagsJson).run();
        
        await logEvent(env.DB, user.id, 'contact.created', { contactId, email });
        
        const contact = await env.DB.prepare(
            'SELECT id, email, first_name, last_name, tags_json, created_at FROM contacts WHERE id = ?'
        ).bind(contactId).first();
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse(contact, 201)),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Create contact error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to create contact', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
