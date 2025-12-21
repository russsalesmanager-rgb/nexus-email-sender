/**
 * GET /api/contacts/:id - Get a single contact
 * PUT /api/contacts/:id - Update a contact
 * DELETE /api/contacts/:id - Delete a contact
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail } from '../../utils.js';
import { generateUUID } from '../../crypto.js';

export async function onRequestGet(context) {
    const { env, params, data } = context;
    const user = data.user;
    const contactId = params.id;
    
    try {
        const contact = await env.DB
            .prepare(`
                SELECT id, email, first_name, last_name, tags_json, created_at
                FROM contacts
                WHERE id = ? AND user_id = ?
            `)
            .bind(contactId, user.id)
            .first();
        
        if (!contact) {
            return errorResponse('Contact not found', 404);
        }
        
        return jsonResponse({
            contact: {
                ...contact,
                tags: JSON.parse(contact.tags_json || '[]')
            }
        });
    } catch (error) {
        console.error('Get contact error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params, data } = context;
    const user = data.user;
    const contactId = params.id;
    
    try {
        const body = await parseBody(request);
        const { email, first_name, last_name, tags } = body;
        
        // Check contact exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?')
            .bind(contactId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Contact not found', 404);
        }
        
        // Validate email if provided
        if (email && !isValidEmail(email)) {
            return errorResponse('Invalid email format', 400);
        }
        
        // Update contact
        const tagsJson = tags ? JSON.stringify(tags) : undefined;
        
        await env.DB
            .prepare(`
                UPDATE contacts
                SET email = COALESCE(?, email),
                    first_name = COALESCE(?, first_name),
                    last_name = COALESCE(?, last_name),
                    tags_json = COALESCE(?, tags_json)
                WHERE id = ? AND user_id = ?
            `)
            .bind(
                email ? email.toLowerCase() : null,
                first_name || null,
                last_name || null,
                tagsJson || null,
                contactId,
                user.id
            )
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'contact.updated', JSON.stringify({ contactId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Update contact error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params, data } = context;
    const user = data.user;
    const contactId = params.id;
    
    try {
        // Check contact exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?')
            .bind(contactId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Contact not found', 404);
        }
        
        // Delete contact (will cascade delete list_members and campaign_jobs)
        await env.DB
            .prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?')
            .bind(contactId, user.id)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'contact.deleted', JSON.stringify({ contactId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Delete contact error:', error);
        return errorResponse('Internal server error', 500);
    }
}
