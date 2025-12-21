/**
 * POST /api/campaigns/:id/queue
 * Create campaign jobs for all contacts in the campaign's list
 */

import { jsonResponse, errorResponse } from '../../../utils.js';
import { generateUUID } from '../../../crypto.js';

export async function onRequestPost(context) {
    const { env, params, data } = context;
    const user = data.user;
    const campaignId = params.id;
    
    try {
        // Get campaign and verify it belongs to user
        const campaign = await env.DB
            .prepare(`
                SELECT id, list_id, status
                FROM campaigns
                WHERE id = ? AND user_id = ?
            `)
            .bind(campaignId, user.id)
            .first();
        
        if (!campaign) {
            return errorResponse('Campaign not found', 404);
        }
        
        if (!campaign.list_id) {
            return errorResponse('Campaign has no list assigned', 400);
        }
        
        // Get all contacts in the list
        const { results: contacts } = await env.DB
            .prepare(`
                SELECT c.id
                FROM contacts c
                JOIN list_members lm ON c.id = lm.contact_id
                WHERE lm.list_id = ?
            `)
            .bind(campaign.list_id)
            .all();
        
        if (contacts.length === 0) {
            return errorResponse('List has no contacts', 400);
        }
        
        // Create campaign jobs for each contact
        let queued = 0;
        
        for (const contact of contacts) {
            // Check if job already exists
            const existingJob = await env.DB
                .prepare(`
                    SELECT id FROM campaign_jobs
                    WHERE campaign_id = ? AND contact_id = ?
                `)
                .bind(campaignId, contact.id)
                .first();
            
            if (!existingJob) {
                const jobId = generateUUID();
                
                await env.DB
                    .prepare(`
                        INSERT INTO campaign_jobs (id, campaign_id, contact_id, status)
                        VALUES (?, ?, ?, 'queued')
                    `)
                    .bind(jobId, campaignId, contact.id)
                    .run();
                
                queued++;
            }
        }
        
        // Update campaign status to 'queued'
        await env.DB
            .prepare('UPDATE campaigns SET status = ? WHERE id = ?')
            .bind('queued', campaignId)
            .run();
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(
                generateUUID(),
                user.id,
                'campaign.queued',
                JSON.stringify({ campaignId, queued })
            )
            .run();
        
        return jsonResponse({
            success: true,
            queued,
            total: contacts.length
        });
    } catch (error) {
        console.error('Queue campaign error:', error);
        return errorResponse('Internal server error', 500);
    }
}
