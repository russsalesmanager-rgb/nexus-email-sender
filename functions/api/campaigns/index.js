/**
 * GET /api/campaigns - List all campaigns for the user
 * POST /api/campaigns - Create a new campaign
 */

import { jsonResponse, errorResponse, parseBody } from '../utils.js';
import { generateUUID } from '../crypto.js';

export async function onRequestGet(context) {
    const { env, data } = context;
    const user = data.user;
    
    try {
        const { results } = await env.DB
            .prepare(`
                SELECT c.id, c.name, c.sender_id, c.template_id, c.list_id, c.status, c.created_at,
                       s.from_name, s.from_email,
                       t.name as template_name,
                       l.name as list_name
                FROM campaigns c
                LEFT JOIN senders s ON c.sender_id = s.id
                LEFT JOIN templates t ON c.template_id = t.id
                LEFT JOIN lists l ON c.list_id = l.id
                WHERE c.user_id = ?
                ORDER BY c.created_at DESC
            `)
            .bind(user.id)
            .all();
        
        return jsonResponse({ campaigns: results });
    } catch (error) {
        console.error('Get campaigns error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;
    
    try {
        const body = await parseBody(request);
        const { name, sender_id, template_id, list_id, status } = body;
        
        // Validate
        if (!name || !name.trim()) {
            return errorResponse('Campaign name is required', 400);
        }
        
        // Validate references belong to user
        if (sender_id) {
            const sender = await env.DB
                .prepare('SELECT id FROM senders WHERE id = ? AND user_id = ?')
                .bind(sender_id, user.id)
                .first();
            
            if (!sender) {
                return errorResponse('Invalid sender_id', 400);
            }
        }
        
        if (template_id) {
            const template = await env.DB
                .prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
                .bind(template_id, user.id)
                .first();
            
            if (!template) {
                return errorResponse('Invalid template_id', 400);
            }
        }
        
        if (list_id) {
            const list = await env.DB
                .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
                .bind(list_id, user.id)
                .first();
            
            if (!list) {
                return errorResponse('Invalid list_id', 400);
            }
        }
        
        // Create campaign
        const campaignId = generateUUID();
        const campaignStatus = status || 'draft';
        
        await env.DB
            .prepare(`
                INSERT INTO campaigns (id, user_id, name, sender_id, template_id, list_id, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(campaignId, user.id, name.trim(), sender_id || null, template_id || null, list_id || null, campaignStatus)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'campaign.created', JSON.stringify({ campaignId, name }))
            .run();
        
        return jsonResponse({
            success: true,
            campaign: {
                id: campaignId,
                name: name.trim(),
                sender_id: sender_id || null,
                template_id: template_id || null,
                list_id: list_id || null,
                status: campaignStatus
            }
        }, 201);
    } catch (error) {
        console.error('Create campaign error:', error);
        return errorResponse('Internal server error', 500);
    }
}
