/**
 * GET /api/campaigns/:id - Get a single campaign
 * PUT /api/campaigns/:id - Update a campaign
 * DELETE /api/campaigns/:id - Delete a campaign
 */

import { jsonResponse, errorResponse, parseBody } from '../../utils.js';
import { generateUUID } from '../../crypto.js';

export async function onRequestGet(context) {
    const { env, params, data } = context;
    const user = data.user;
    const campaignId = params.id;
    
    try {
        const campaign = await env.DB
            .prepare(`
                SELECT c.id, c.name, c.sender_id, c.template_id, c.list_id, c.status, c.created_at,
                       s.from_name, s.from_email,
                       t.name as template_name, t.subject, t.html, t.text,
                       l.name as list_name
                FROM campaigns c
                LEFT JOIN senders s ON c.sender_id = s.id
                LEFT JOIN templates t ON c.template_id = t.id
                LEFT JOIN lists l ON c.list_id = l.id
                WHERE c.id = ? AND c.user_id = ?
            `)
            .bind(campaignId, user.id)
            .first();
        
        if (!campaign) {
            return errorResponse('Campaign not found', 404);
        }
        
        return jsonResponse({ campaign });
    } catch (error) {
        console.error('Get campaign error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params, data } = context;
    const user = data.user;
    const campaignId = params.id;
    
    try {
        const body = await parseBody(request);
        const { name, sender_id, template_id, list_id, status } = body;
        
        // Check campaign exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?')
            .bind(campaignId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Campaign not found', 404);
        }
        
        // Validate references if provided
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
        
        // Update campaign
        await env.DB
            .prepare(`
                UPDATE campaigns
                SET name = COALESCE(?, name),
                    sender_id = COALESCE(?, sender_id),
                    template_id = COALESCE(?, template_id),
                    list_id = COALESCE(?, list_id),
                    status = COALESCE(?, status)
                WHERE id = ? AND user_id = ?
            `)
            .bind(
                name || null,
                sender_id || null,
                template_id || null,
                list_id || null,
                status || null,
                campaignId,
                user.id
            )
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'campaign.updated', JSON.stringify({ campaignId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Update campaign error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params, data } = context;
    const user = data.user;
    const campaignId = params.id;
    
    try {
        // Check campaign exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?')
            .bind(campaignId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Campaign not found', 404);
        }
        
        // Delete campaign (will cascade delete campaign_jobs)
        await env.DB
            .prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?')
            .bind(campaignId, user.id)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'campaign.deleted', JSON.stringify({ campaignId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Delete campaign error:', error);
        return errorResponse('Internal server error', 500);
    }
}
