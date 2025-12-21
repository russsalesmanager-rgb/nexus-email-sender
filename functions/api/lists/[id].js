// GET /api/lists/:id - Get a specific list with members
// PUT /api/lists/:id - Update a list
// DELETE /api/lists/:id - Delete a list
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import {
  successResponse,
  errorResponse,
  logEvent,
} from '../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  // Require authentication
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const list = await env.DB
      .prepare('SELECT id, name, created_at FROM lists WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!list) {
      return addCORSHeaders(
        errorResponse('Not found', 'List not found', 404),
        env
      );
    }
    
    // Get members
    const { results: members } = await env.DB
      .prepare(`
        SELECT c.id, c.email, c.first_name, c.last_name, c.tags_json, lm.created_at as added_at
        FROM list_members lm
        JOIN contacts c ON lm.contact_id = c.id
        WHERE lm.list_id = ?
        ORDER BY lm.created_at DESC
      `)
      .bind(params.id)
      .all();
    
    return addCORSHeaders(
      successResponse({
        list: {
          ...list,
          members: members.map(m => ({
            ...m,
            tags: JSON.parse(m.tags_json || '[]'),
            tags_json: undefined,
          })),
        },
      }),
      env
    );
  } catch (error) {
    console.error('Get list error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  // Require authentication
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const body = await request.json();
    const { name } = body;
    
    // Check if list exists
    const existing = await env.DB
      .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(
        errorResponse('Not found', 'List not found', 404),
        env
      );
    }
    
    // Validate input
    if (!name || name.trim().length === 0) {
      return addCORSHeaders(
        errorResponse('Invalid input', 'List name is required'),
        env
      );
    }
    
    // Update list
    await env.DB
      .prepare('UPDATE lists SET name = ? WHERE id = ? AND user_id = ?')
      .bind(name.trim(), params.id, auth.user.id)
      .run();
    
    // Log event
    await logEvent(env.DB, auth.user.id, 'list.updated', { list_id: params.id, name });
    
    // Fetch updated list
    const list = await env.DB
      .prepare('SELECT id, name, created_at FROM lists WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    return addCORSHeaders(successResponse({ list }), env);
  } catch (error) {
    console.error('Update list error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  // Require authentication
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    // Check if list exists
    const existing = await env.DB
      .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(
        errorResponse('Not found', 'List not found', 404),
        env
      );
    }
    
    // Delete list (cascade will delete list_members)
    await env.DB
      .prepare('DELETE FROM lists WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .run();
    
    // Log event
    await logEvent(env.DB, auth.user.id, 'list.deleted', { list_id: params.id });
    
    return addCORSHeaders(
      successResponse({ message: 'List deleted successfully' }),
      env
    );
  } catch (error) {
    console.error('Delete list error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
