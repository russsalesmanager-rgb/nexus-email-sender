// GET /api/senders/:id - Get a specific sender
// PUT /api/senders/:id - Update a sender
// DELETE /api/senders/:id - Delete a sender
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import { isValidEmail, successResponse, errorResponse, logEvent } from '../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const sender = await env.DB
      .prepare('SELECT id, from_name, from_email, reply_to, created_at FROM senders WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!sender) {
      return addCORSHeaders(errorResponse('Not found', 'Sender not found', 404), env);
    }
    
    return addCORSHeaders(successResponse({ sender }), env);
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
    const { from_name, from_email, reply_to } = body;
    
    const existing = await env.DB
      .prepare('SELECT id FROM senders WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(errorResponse('Not found', 'Sender not found', 404), env);
    }
    
    if (from_email && !isValidEmail(from_email)) {
      return addCORSHeaders(errorResponse('Invalid email', 'Please provide a valid from email'), env);
    }
    
    if (reply_to && !isValidEmail(reply_to)) {
      return addCORSHeaders(errorResponse('Invalid email', 'Please provide a valid reply-to email'), env);
    }
    
    const updates = [];
    const bindings = [];
    
    if (from_name !== undefined) { updates.push('from_name = ?'); bindings.push(from_name); }
    if (from_email !== undefined) { updates.push('from_email = ?'); bindings.push(from_email); }
    if (reply_to !== undefined) { updates.push('reply_to = ?'); bindings.push(reply_to || null); }
    
    if (updates.length > 0) {
      bindings.push(params.id, auth.user.id);
      await env.DB
        .prepare(`UPDATE senders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...bindings)
        .run();
    }
    
    await logEvent(env.DB, auth.user.id, 'sender.updated', { sender_id: params.id });
    
    const sender = await env.DB
      .prepare('SELECT id, from_name, from_email, reply_to, created_at FROM senders WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    return addCORSHeaders(successResponse({ sender }), env);
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
      .prepare('SELECT id FROM senders WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(errorResponse('Not found', 'Sender not found', 404), env);
    }
    
    await env.DB
      .prepare('DELETE FROM senders WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .run();
    
    await logEvent(env.DB, auth.user.id, 'sender.deleted', { sender_id: params.id });
    
    return addCORSHeaders(successResponse({ message: 'Sender deleted successfully' }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
