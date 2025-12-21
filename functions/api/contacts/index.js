/**
 * GET /api/contacts - List all contacts for the user
 * POST /api/contacts - Create a new contact
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail, now } from '../utils.js';
import { generateUUID } from '../crypto.js';

export async function onRequestGet(context) {
    const { env, data } = context;
    const user = data.user;
    
    try {
        const { results } = await env.DB
            .prepare(`
                SELECT id, email, first_name, last_name, tags_json, created_at
                FROM contacts
                WHERE user_id = ?
                ORDER BY created_at DESC
            `)
            .bind(user.id)
            .all();
        
        // Parse tags_json for each contact
        const contacts = results.map(c => ({
            ...c,
            tags: JSON.parse(c.tags_json || '[]')
        }));
        
        return jsonResponse({ contacts });
    } catch (error) {
        console.error('Get contacts error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;
    
    try {
        const body = await parseBody(request);
        const { email, first_name, last_name, tags } = body;
        
        // Validate
        if (!email || !isValidEmail(email)) {
            return errorResponse('Valid email is required', 400);
        }
        
        // Check for duplicates
        const existing = await env.DB
            .prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?')
            .bind(user.id, email.toLowerCase())
            .first();
        
        if (existing) {
            return errorResponse('Contact with this email already exists', 409);
        }
        
        // Create contact
        const contactId = generateUUID();
        const tagsJson = JSON.stringify(tags || []);
        
        await env.DB
            .prepare(`
                INSERT INTO contacts (id, user_id, email, first_name, last_name, tags_json)
                VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(contactId, user.id, email.toLowerCase(), first_name || null, last_name || null, tagsJson)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'contact.created', JSON.stringify({ contactId, email }))
            .run();
        
        return jsonResponse({
            success: true,
            contact: {
                id: contactId,
                email: email.toLowerCase(),
                first_name: first_name || null,
                last_name: last_name || null,
                tags: tags || []
            }
        }, 201);
    } catch (error) {
        console.error('Create contact error:', error);
        return errorResponse('Internal server error', 500);
    }
}
