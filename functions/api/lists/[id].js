/**
 * GET /api/lists/:id - Get a single list
 * PUT /api/lists/:id - Update a list
 * DELETE /api/lists/:id - Delete a list
 */

import { jsonResponse, errorResponse, parseBody } from '../../utils.js';
import { generateUUID } from '../../crypto.js';

export async function onRequestGet(context) {
    const { env, params, data } = context;
    const user = data.user;
    const listId = params.id;
    
    try {
        // Get list with contact count
        const list = await env.DB
            .prepare(`
                SELECT l.id, l.name, l.created_at,
                       COUNT(lm.contact_id) as contact_count
                FROM lists l
                LEFT JOIN list_members lm ON l.id = lm.list_id
                WHERE l.id = ? AND l.user_id = ?
                GROUP BY l.id
            `)
            .bind(listId, user.id)
            .first();
        
        if (!list) {
            return errorResponse('List not found', 404);
        }
        
        // Get contacts in this list
        const { results: contacts } = await env.DB
            .prepare(`
                SELECT c.id, c.email, c.first_name, c.last_name
                FROM contacts c
                JOIN list_members lm ON c.id = lm.contact_id
                WHERE lm.list_id = ?
                ORDER BY c.email
            `)
            .bind(listId)
            .all();
        
        return jsonResponse({
            list: {
                ...list,
                contacts
            }
        });
    } catch (error) {
        console.error('Get list error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params, data } = context;
    const user = data.user;
    const listId = params.id;
    
    try {
        const body = await parseBody(request);
        const { name } = body;
        
        if (!name || !name.trim()) {
            return errorResponse('List name is required', 400);
        }
        
        // Check list exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
            .bind(listId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('List not found', 404);
        }
        
        // Update list
        await env.DB
            .prepare('UPDATE lists SET name = ? WHERE id = ? AND user_id = ?')
            .bind(name.trim(), listId, user.id)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'list.updated', JSON.stringify({ listId, name }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Update list error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params, data } = context;
    const user = data.user;
    const listId = params.id;
    
    try {
        // Check list exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
            .bind(listId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('List not found', 404);
        }
        
        // Delete list (will cascade delete list_members)
        await env.DB
            .prepare('DELETE FROM lists WHERE id = ? AND user_id = ?')
            .bind(listId, user.id)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'list.deleted', JSON.stringify({ listId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Delete list error:', error);
        return errorResponse('Internal server error', 500);
    }
}
