/**
 * GET /api/templates/:id - Get a single template
 * PUT /api/templates/:id - Update a template
 * DELETE /api/templates/:id - Delete a template
 */

import { jsonResponse, errorResponse, parseBody } from '../../utils.js';
import { generateUUID } from '../../crypto.js';

export async function onRequestGet(context) {
    const { env, params, data } = context;
    const user = data.user;
    const templateId = params.id;
    
    try {
        const template = await env.DB
            .prepare(`
                SELECT id, name, subject, html, text, created_at
                FROM templates
                WHERE id = ? AND user_id = ?
            `)
            .bind(templateId, user.id)
            .first();
        
        if (!template) {
            return errorResponse('Template not found', 404);
        }
        
        return jsonResponse({ template });
    } catch (error) {
        console.error('Get template error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params, data } = context;
    const user = data.user;
    const templateId = params.id;
    
    try {
        const body = await parseBody(request);
        const { name, subject, html, text } = body;
        
        // Check template exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
            .bind(templateId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Template not found', 404);
        }
        
        // Update template
        await env.DB
            .prepare(`
                UPDATE templates
                SET name = COALESCE(?, name),
                    subject = COALESCE(?, subject),
                    html = COALESCE(?, html),
                    text = COALESCE(?, text)
                WHERE id = ? AND user_id = ?
            `)
            .bind(
                name || null,
                subject || null,
                html || null,
                text || null,
                templateId,
                user.id
            )
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'template.updated', JSON.stringify({ templateId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Update template error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params, data } = context;
    const user = data.user;
    const templateId = params.id;
    
    try {
        // Check template exists and belongs to user
        const existing = await env.DB
            .prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
            .bind(templateId, user.id)
            .first();
        
        if (!existing) {
            return errorResponse('Template not found', 404);
        }
        
        // Delete template
        await env.DB
            .prepare('DELETE FROM templates WHERE id = ? AND user_id = ?')
            .bind(templateId, user.id)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'template.deleted', JSON.stringify({ templateId }))
            .run();
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Delete template error:', error);
        return errorResponse('Internal server error', 500);
    }
}
