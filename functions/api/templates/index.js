// GET /api/templates - List all templates
// POST /api/templates - Create a new template
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
      .prepare('SELECT id, name, subject, html, text, created_at FROM templates WHERE user_id = ? ORDER BY created_at DESC')
      .bind(auth.user.id)
      .all();
    return addCORSHeaders(successResponse({ templates: results }), env);
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
    const { name, subject, html, text } = body;
    
    if (!name || !subject) {
      return addCORSHeaders(errorResponse('Invalid input', 'Name and subject are required'), env);
    }
    
    const templateId = generateId();
    await env.DB
      .prepare('INSERT INTO templates (id, user_id, name, subject, html, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(templateId, auth.user.id, name, subject, html || null, text || null, now())
      .run();
    
    await logEvent(env.DB, auth.user.id, 'template.created', { template_id: templateId, name });
    
    return addCORSHeaders(successResponse({
      template: { id: templateId, name, subject, html, text, created_at: now() }
    }), env);
  } catch (error) {
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
