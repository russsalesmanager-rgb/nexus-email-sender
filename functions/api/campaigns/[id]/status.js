/**
 * GET /api/campaigns/:id/status
 * Get campaign send status and progress
 */

import { jsonResponse, errorResponse } from '../../../utils.js';

export async function onRequestGet(context) {
    const { env, params, data } = context;
    const user = data.user;
    const campaignId = params.id;
    
    try {
        // Verify campaign belongs to user
        const campaign = await env.DB
            .prepare('SELECT id, status FROM campaigns WHERE id = ? AND user_id = ?')
            .bind(campaignId, user.id)
            .first();
        
        if (!campaign) {
            return errorResponse('Campaign not found', 404);
        }
        
        // Get job status counts
        const { results: statusCounts } = await env.DB
            .prepare(`
                SELECT status, COUNT(*) as count
                FROM campaign_jobs
                WHERE campaign_id = ?
                GROUP BY status
            `)
            .bind(campaignId)
            .all();
        
        // Convert to object
        const stats = {
            queued: 0,
            sent: 0,
            failed: 0,
            total: 0
        };
        
        statusCounts.forEach(row => {
            stats[row.status] = row.count;
            stats.total += row.count;
        });
        
        return jsonResponse({
            campaign_id: campaignId,
            status: campaign.status,
            ...stats
        });
    } catch (error) {
        console.error('Get campaign status error:', error);
        return errorResponse('Internal server error', 500);
    }
}
