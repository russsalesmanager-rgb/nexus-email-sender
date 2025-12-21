// GET /api/contacts/:id - Get a specific contact
// PUT /api/contacts/:id - Update a contact
// DELETE /api/contacts/:id - Delete a contact
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import {
  isValidEmail,
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
    const contact = await env.DB
      .prepare('SELECT id, email, first_name, last_name, tags_json, created_at FROM contacts WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!contact) {
      return addCORSHeaders(
        errorResponse('Not found', 'Contact not found', 404),
        env
      );
    }
    
    return addCORSHeaders(
      successResponse({
        contact: {
          ...contact,
          tags: JSON.parse(contact.tags_json || '[]'),
          tags_json: undefined,
        },
      }),
      env
    );
  } catch (error) {
    console.error('Get contact error:', error);
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
    const { email, first_name, last_name, tags } = body;
    
    // Check if contact exists
    const existing = await env.DB
      .prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(
        errorResponse('Not found', 'Contact not found', 404),
        env
      );
    }
    
    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return addCORSHeaders(
        errorResponse('Invalid email', 'Please provide a valid email address'),
        env
      );
    }
    
    // Update contact
    const updates = [];
    const bindings = [];
    
    if (email !== undefined) {
      updates.push('email = ?');
      bindings.push(email.toLowerCase());
    }
    if (first_name !== undefined) {
      updates.push('first_name = ?');
      bindings.push(first_name || null);
    }
    if (last_name !== undefined) {
      updates.push('last_name = ?');
      bindings.push(last_name || null);
    }
    if (tags !== undefined) {
      updates.push('tags_json = ?');
      bindings.push(JSON.stringify(tags));
    }
    
    if (updates.length > 0) {
      bindings.push(params.id, auth.user.id);
      
      await env.DB
        .prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...bindings)
        .run();
    }
    
    // Log event
    await logEvent(env.DB, auth.user.id, 'contact.updated', { contact_id: params.id });
    
    // Fetch updated contact
    const contact = await env.DB
      .prepare('SELECT id, email, first_name, last_name, tags_json, created_at FROM contacts WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    return addCORSHeaders(
      successResponse({
        contact: {
          ...contact,
          tags: JSON.parse(contact.tags_json || '[]'),
          tags_json: undefined,
        },
      }),
      env
    );
  } catch (error) {
    console.error('Update contact error:', error);
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
    // Check if contact exists
    const existing = await env.DB
      .prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!existing) {
      return addCORSHeaders(
        errorResponse('Not found', 'Contact not found', 404),
        env
      );
    }
    
    // Delete contact
    await env.DB
      .prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .run();
    
    // Log event
    await logEvent(env.DB, auth.user.id, 'contact.deleted', { contact_id: params.id });
    
    return addCORSHeaders(
      successResponse({ message: 'Contact deleted successfully' }),
      env
    );
  } catch (error) {
    console.error('Delete contact error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
