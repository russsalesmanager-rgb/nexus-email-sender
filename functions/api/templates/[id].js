// GET /api/templates/:id - Get a specific template
// PUT /api/templates/:id - Update a template
// DELETE /api/templates/:id - Delete a template
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import { successResponse, errorResponse, logEvent } from '../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const template = await env.DB
      .prepare('SELECT id, name, subject, html, text, created_at FROM templates WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!template) {
      return addCORSHeaders(errorResponse('Not found', 'Template not found', 404), env);
    }
    
    return addCORSHeaders(successResponse({ template }), env);
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
    const { name, subject, html, text } = body;
    
    const existing = await env.DB
      .prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(errorResponse('Not found', 'Template not found', 404), env);
    }
    
    const updates = [];
    const bindings = [];
    
    if (name !== undefined) { updates.push('name = ?'); bindings.push(name); }
    if (subject !== undefined) { updates.push('subject = ?'); bindings.push(subject); }
    if (html !== undefined) { updates.push('html = ?'); bindings.push(html); }
    if (text !== undefined) { updates.push('text = ?'); bindings.push(text); }
    
    if (updates.length > 0) {
      bindings.push(params.id, auth.user.id);
      await env.DB
        .prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...bindings)
        .run();
    }
    
    await logEvent(env.DB, auth.user.id, 'template.updated', { template_id: params.id });
    
    const template = await env.DB
      .prepare('SELECT id, name, subject, html, text, created_at FROM templates WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    return addCORSHeaders(successResponse({ template }), env);
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
      .prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(errorResponse('Not found', 'Template not found', 404), env);
    }
    
    await env.DB
      .prepare('DELETE FROM templates WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .run();
    
    await logEvent(env.DB, auth.user.id, 'template.deleted', { template_id: params.id });
    
    return addCORSHeaders(successResponse({ message: 'Template deleted successfully' }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
