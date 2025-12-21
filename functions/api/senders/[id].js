/**
 * GET /api/senders/:id - Get a single sender
 * PUT /api/senders/:id - Update a sender
 * DELETE /api/senders/:id - Delete a sender
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail } from '../../utils.js';
import { generateUUID } from '../../crypto.js';

export async function onRequestGet(context) {
    const { env, params, data } = context;
    const user = data.user;
    const senderId = params.id;
    
    try {
        const sender = await env.DB
            .prepare(`
                SELECT id, from_name, from_email, reply_to, created_at
                FROM senders
                WHERE id = ? AND user_id = ?
            `)
            .bind(senderId, user.id)
            .first();
        
        if (!sender) {
            return errorResponse('Sender not found', 404);
        }
        
        return jsonResponse({ sender });
    } catch (error) {
        console.error('Get sender error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params, data } = context;
    const user = data.user;
    const senderId = params.id;
    
    try {
        const body = await parseBody(request);
        const { from_name, from_email, reply_to } = body;
        
        // Check sender exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM senders WHERE id = ? AND user_id = ?')
            .bind(senderId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Sender not found', 404);
        }
        
        // Validate email if provided
        if (from_email && !isValidEmail(from_email)) {
            return errorResponse('Invalid from email', 400);
        }
        
        if (reply_to && !isValidEmail(reply_to)) {
            return errorResponse('Invalid reply-to email', 400);
        }
        
        // Update sender
        await env.DB
            .prepare(`
                UPDATE senders
                SET from_name = COALESCE(?, from_name),
                    from_email = COALESCE(?, from_email),
                    reply_to = COALESCE(?, reply_to)
                WHERE id = ? AND user_id = ?
            `)
            .bind(
                from_name || null,
                from_email ? from_email.toLowerCase() : null,
                reply_to ? reply_to.toLowerCase() : null,
                senderId,
                user.id
            )
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'sender.updated', JSON.stringify({ senderId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Update sender error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params, data } = context;
    const user = data.user;
    const senderId = params.id;
    
    try {
        // Check sender exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM senders WHERE id = ? AND user_id = ?')
            .bind(senderId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Sender not found', 404);
        }
        
        // Delete sender
        await env.DB
            .prepare('DELETE FROM senders WHERE id = ? AND user_id = ?')
            .bind(senderId, user.id)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'sender.deleted', JSON.stringify({ senderId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Delete sender error:', error);
        return errorResponse('Internal server error', 500);
    }
}
