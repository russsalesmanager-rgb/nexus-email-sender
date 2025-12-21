/**
 * GET /api/templates - List all templates for the user
 * POST /api/templates - Create a new template
 */

import { jsonResponse, errorResponse, parseBody } from '../utils.js';
import { generateUUID } from '../crypto.js';

export async function onRequestGet(context) {
    const { env, data } = context;
    const user = data.user;
    
    try {
        const { results } = await env.DB
            .prepare(`
                SELECT id, name, subject, html, text, created_at
                FROM templates
                WHERE user_id = ?
                ORDER BY created_at DESC
            `)
            .bind(user.id)
            .all();
        
        return jsonResponse({ templates: results });
    } catch (error) {
        console.error('Get templates error:', error);
        return errorResponse('Internal server error', 500);
    }
}

export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;
    
    try {
        const body = await parseBody(request);
        const { name, subject, html, text } = body;
        
        // Validate
        if (!name || !name.trim()) {
            return errorResponse('Template name is required', 400);
        }
        
        if (!subject || !subject.trim()) {
            return errorResponse('Subject is required', 400);
        }
        
        if (!html || !html.trim()) {
            return errorResponse('HTML content is required', 400);
        }
        
        // Create template
        const templateId = generateUUID();
        
        await env.DB
            .prepare(`
                INSERT INTO templates (id, user_id, name, subject, html, text)
                VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(templateId, user.id, name.trim(), subject.trim(), html, text || null)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(generateUUID(), user.id, 'template.created', JSON.stringify({ templateId, name }))
            .run();
        
        return jsonResponse({
            success: true,
            template: {
                id: templateId,
                name: name.trim(),
                subject: subject.trim(),
                html,
                text: text || null
            }
        }, 201);
    } catch (error) {
        console.error('Create template error:', error);
        return errorResponse('Internal server error', 500);
    }
}
