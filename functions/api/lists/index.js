/**
 * GET /api/lists - List all lists for the user
 * POST /api/lists - Create a new list
 */

import { jsonResponse, errorResponse, parseBody } from '../utils.js';
import { generateUUID } from '../crypto.js';

export async function onRequestGet(context) {
    const { env, data } = context;
    const user = data.user;
    
    try {
        const { results } = await env.DB
            .prepare(`
                SELECT l.id, l.name, l.created_at,
                       COUNT(lm.contact_id) as contact_count
                FROM lists l
                LEFT JOIN list_members lm ON l.id = lm.list_id
                WHERE l.user_id = ?
                GROUP BY l.id
                ORDER BY l.created_at DESC
            `)
            .bind(user.id)
            .all();
        
        return jsonResponse({ lists: results });
    } catch (error) {
        console.error('Get lists error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;
    
    try {
        const body = await parseBody(request);
        const { name } = body;
        
        if (!name || !name.trim()) {
            return errorResponse('List name is required', 400);
        }
        
        // Create list
        const listId = generateUUID();
        
        await env.DB
            .prepare('INSERT INTO lists (id, user_id, name) VALUES (?, ?, ?)')
            .bind(listId, user.id, name.trim())
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'list.created', JSON.stringify({ listId, name }))
            .run();
        
        return jsonResponse({
            success: true,
            list: {
                id: listId,
                name: name.trim(),
                contact_count: 0
            }
        }, 201);
    } catch (error) {
        console.error('Create list error:', error);
        return errorResponse('Internal server error', 500);
    }
}
