// GET /api/lists - List all lists for the authenticated user
// POST /api/lists - Create a new list
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import {
  generateId,
  now,
  successResponse,
  errorResponse,
  logEvent,
} from '../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  // Require authentication
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const { results } = await env.DB
      .prepare('SELECT id, name, created_at FROM lists WHERE user_id = ? ORDER BY created_at DESC')
      .bind(auth.user.id)
      .all();
    
    // Get member counts for each list
    const lists = await Promise.all(
      results.map(async (list) => {
        const count = await env.DB
          .prepare('SELECT COUNT(*) as count FROM list_members WHERE list_id = ?')
          .bind(list.id)
          .first();
        
        return {
          ...list,
          member_count: count.count,
        };
      })
    );
    
    return addCORSHeaders(successResponse({ lists }), env);
  } catch (error) {
    console.error('Get lists error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  // Require authentication
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const body = await request.json();
    const { name } = body;
    
    // Validate input
    if (!name || name.trim().length === 0) {
      return addCORSHeaders(
        errorResponse('Invalid input', 'List name is required'),
        env
      );
    }
    
    // Create list
    const listId = generateId();
    
    await env.DB
      .prepare('INSERT INTO lists (id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
      .bind(listId, auth.user.id, name.trim(), now())
      .run();
    
    // Log event
    await logEvent(env.DB, auth.user.id, 'list.created', { list_id: listId, name });
    
    const list = {
      id: listId,
      name: name.trim(),
      created_at: now(),
      member_count: 0,
    };
    
    return addCORSHeaders(successResponse({ list }), env);
  } catch (error) {
    console.error('Create list error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
