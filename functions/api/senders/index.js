// GET /api/senders - List all senders
// POST /api/senders - Create a new sender
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import { generateId, now, isValidEmail, successResponse, errorResponse, logEvent } from '../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const { results } = await env.DB
      .prepare('SELECT id, from_name, from_email, reply_to, created_at FROM senders WHERE user_id = ? ORDER BY created_at DESC')
      .bind(auth.user.id)
      .all();
    return addCORSHeaders(successResponse({ senders: results }), env);
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
    const { from_name, from_email, reply_to } = body;
    
    if (!from_name || !from_email) {
      return addCORSHeaders(errorResponse('Invalid input', 'From name and email are required'), env);
    }
    
    if (!isValidEmail(from_email)) {
      return addCORSHeaders(errorResponse('Invalid email', 'Please provide a valid from email'), env);
    }
    
    if (reply_to && !isValidEmail(reply_to)) {
      return addCORSHeaders(errorResponse('Invalid email', 'Please provide a valid reply-to email'), env);
    }
    
    const senderId = generateId();
    await env.DB
      .prepare('INSERT INTO senders (id, user_id, from_name, from_email, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(senderId, auth.user.id, from_name, from_email, reply_to || null, now())
      .run();
    
    await logEvent(env.DB, auth.user.id, 'sender.created', { sender_id: senderId, from_email });
    
    return addCORSHeaders(successResponse({
      sender: { id: senderId, from_name, from_email, reply_to: reply_to || null, created_at: now() }
    }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
