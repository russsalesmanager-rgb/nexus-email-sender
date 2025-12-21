// GET /api/campaigns/:id - Get a specific campaign
// PUT /api/campaigns/:id - Update a campaign
// DELETE /api/campaigns/:id - Delete a campaign
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import { successResponse, errorResponse, logEvent } from '../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const campaign = await env.DB
      .prepare('SELECT id, name, sender_id, template_id, list_id, status, created_at FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!campaign) {
      return addCORSHeaders(errorResponse('Not found', 'Campaign not found', 404), env);
    }
    
    return addCORSHeaders(successResponse({ campaign }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const body = await request.json();
    const { name, status } = body;
    
    const existing = await env.DB
      .prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(errorResponse('Not found', 'Campaign not found', 404), env);
    }
    
    const updates = [];
    const bindings = [];
    
    if (name !== undefined) { updates.push('name = ?'); bindings.push(name); }
    if (status !== undefined) { 
      if (!['draft', 'queued', 'sending', 'completed', 'paused'].includes(status)) {
        return addCORSHeaders(errorResponse('Invalid status', 'Status must be draft, queued, sending, completed, or paused'), env);
      }
      updates.push('status = ?'); 
      bindings.push(status); 
    }
    
    if (updates.length > 0) {
      bindings.push(params.id, auth.user.id);
      await env.DB
        .prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...bindings)
        .run();
    }
    
    await logEvent(env.DB, auth.user.id, 'campaign.updated', { campaign_id: params.id });
    
    const campaign = await env.DB
      .prepare('SELECT id, name, sender_id, template_id, list_id, status, created_at FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    return addCORSHeaders(successResponse({ campaign }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const existing = await env.DB
      .prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(errorResponse('Not found', 'Campaign not found', 404), env);
    }
    
    await env.DB
      .prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .run();
    
    await logEvent(env.DB, auth.user.id, 'campaign.deleted', { campaign_id: params.id });
    
    return addCORSHeaders(successResponse({ message: 'Campaign deleted successfully' }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
