// POST /api/campaigns/:id/queue - Create campaign jobs for all contacts in the list
import { requireAuth, handleCORS, addCORSHeaders } from '../../../_shared/auth.js';
import { generateId, now, successResponse, errorResponse, logEvent } from '../../../_shared/utils.js';

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    // Get campaign
    const campaign = await env.DB
      .prepare('SELECT id, list_id, status FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!campaign) {
      return addCORSHeaders(errorResponse('Not found', 'Campaign not found', 404), env);
    }
    
    if (campaign.status !== 'draft') {
      return addCORSHeaders(errorResponse('Invalid status', 'Campaign has already been queued'), env);
    }
    
    // Get all contacts in the list
    const { results: contacts } = await env.DB
      .prepare(`
        SELECT c.id
        FROM list_members lm
        JOIN contacts c ON lm.contact_id = c.id
        WHERE lm.list_id = ?
      `)
      .bind(campaign.list_id)
      .all();
    
    if (contacts.length === 0) {
      return addCORSHeaders(errorResponse('No contacts', 'List has no contacts'), env);
    }
    
    // Create campaign jobs
    for (const contact of contacts) {
      const jobId = generateId();
      await env.DB
        .prepare('INSERT INTO campaign_jobs (id, campaign_id, contact_id, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(jobId, params.id, contact.id, 'queued', now())
        .run();
    }
    
    // Update campaign status
    await env.DB
      .prepare('UPDATE campaigns SET status = ? WHERE id = ?')
      .bind('queued', params.id)
      .run();
    
    await logEvent(env.DB, auth.user.id, 'campaign.queued', {
      campaign_id: params.id,
      jobs_created: contacts.length,
    });
    
    return addCORSHeaders(successResponse({
      message: 'Campaign queued successfully',
      jobs_created: contacts.length,
    }), env);
  } catch (error) {
    console.error('Queue campaign error:', error);
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
