// GET /api/campaigns - List all campaigns
// POST /api/campaigns - Create a new campaign
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import { generateId, now, successResponse, errorResponse, logEvent } from '../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const { results } = await env.DB
      .prepare('SELECT id, name, sender_id, template_id, list_id, status, created_at FROM campaigns WHERE user_id = ? ORDER BY created_at DESC')
      .bind(auth.user.id)
      .all();
    return addCORSHeaders(successResponse({ campaigns: results }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const body = await request.json();
    const { name, sender_id, template_id, list_id } = body;
    
    if (!name || !sender_id || !template_id || !list_id) {
      return addCORSHeaders(
        errorResponse('Invalid input', 'Name, sender_id, template_id, and list_id are required'),
        env
      );
    }
    
    // Verify sender exists and belongs to user
    const sender = await env.DB
      .prepare('SELECT id FROM senders WHERE id = ? AND user_id = ?')
      .bind(sender_id, auth.user.id)
      .first();
    
    if (!sender) {
      return addCORSHeaders(errorResponse('Invalid sender', 'Sender not found'), env);
    }
    
    // Verify template exists and belongs to user
    const template = await env.DB
      .prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
      .bind(template_id, auth.user.id)
      .first();
    
    if (!template) {
      return addCORSHeaders(errorResponse('Invalid template', 'Template not found'), env);
    }
    
    // Verify list exists and belongs to user
    const list = await env.DB
      .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
      .bind(list_id, auth.user.id)
      .first();
    
    if (!list) {
      return addCORSHeaders(errorResponse('Invalid list', 'List not found'), env);
    }
    
    const campaignId = generateId();
    await env.DB
      .prepare('INSERT INTO campaigns (id, user_id, name, sender_id, template_id, list_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(campaignId, auth.user.id, name, sender_id, template_id, list_id, 'draft', now())
      .run();
    
    await logEvent(env.DB, auth.user.id, 'campaign.created', { campaign_id: campaignId, name });
    
    return addCORSHeaders(successResponse({
      campaign: { id: campaignId, name, sender_id, template_id, list_id, status: 'draft', created_at: now() }
    }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
