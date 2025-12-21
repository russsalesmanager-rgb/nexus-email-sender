// GET /api/campaigns/:id/status - Get campaign status and job counts
import { requireAuth, handleCORS, addCORSHeaders } from '../../../_shared/auth.js';
import { successResponse, errorResponse } from '../../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    // Get campaign
    const campaign = await env.DB
      .prepare('SELECT id, name, status FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!campaign) {
      return addCORSHeaders(errorResponse('Not found', 'Campaign not found', 404), env);
    }
    
    // Get job counts
    const { results: counts } = await env.DB
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM campaign_jobs
        WHERE campaign_id = ?
        GROUP BY status
      `)
      .bind(params.id)
      .all();
    
    const statusCounts = {
      queued: 0,
      sent: 0,
      failed: 0,
    };
    
    for (const row of counts) {
      if (row.status in statusCounts) {
        statusCounts[row.status] = row.count;
      }
    }
    
    return addCORSHeaders(successResponse({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      counts: statusCounts,
      total: statusCounts.queued + statusCounts.sent + statusCounts.failed,
    }), env);
  } catch (error) {
    console.error('Get campaign status error:', error);
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
