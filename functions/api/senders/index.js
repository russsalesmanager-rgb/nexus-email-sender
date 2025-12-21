/**
 * GET /api/senders - List all senders for the user
 * POST /api/senders - Create a new sender identity
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail } from '../utils.js';
import { generateUUID } from '../crypto.js';

export async function onRequestGet(context) {
    const { env, data } = context;
    const user = data.user;
    
    try {
        const { results } = await env.DB
            .prepare(`
                SELECT id, from_name, from_email, reply_to, created_at
                FROM senders
                WHERE user_id = ?
                ORDER BY created_at DESC
            `)
            .bind(user.id)
            .all();
        
        return jsonResponse({ senders: results });
    } catch (error) {
        console.error('Get senders error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;
    
    try {
        const body = await parseBody(request);
        const { from_name, from_email, reply_to } = body;
        
        // Validate
        if (!from_name || !from_name.trim()) {
            return errorResponse('From name is required', 400);
        }
        
        if (!from_email || !isValidEmail(from_email)) {
            return errorResponse('Valid from email is required', 400);
        }
        
        if (reply_to && !isValidEmail(reply_to)) {
            return errorResponse('Reply-to email is invalid', 400);
        }
        
        // Create sender
        const senderId = generateUUID();
        
        await env.DB
            .prepare(`
                INSERT INTO senders (id, user_id, from_name, from_email, reply_to)
                VALUES (?, ?, ?, ?, ?)
            `)
            .bind(senderId, user.id, from_name.trim(), from_email.toLowerCase(), reply_to ? reply_to.toLowerCase() : null)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'sender.created', JSON.stringify({ senderId, from_email }))
            .run();
        
        return jsonResponse({
            success: true,
            sender: {
                id: senderId,
                from_name: from_name.trim(),
                from_email: from_email.toLowerCase(),
                reply_to: reply_to ? reply_to.toLowerCase() : null
            }
        }, 201);
    } catch (error) {
        console.error('Create sender error:', error);
        return errorResponse('Internal server error', 500);
    }
}
