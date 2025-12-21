// GET /api/contacts - List all contacts for the authenticated user
// POST /api/contacts - Create a new contact
import { requireAuth, handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import {
  generateId,
  now,
  isValidEmail,
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
      .prepare('SELECT id, email, first_name, last_name, tags_json, created_at FROM contacts WHERE user_id = ? ORDER BY created_at DESC')
      .bind(auth.user.id)
      .all();
    
    // Parse tags_json for each contact
    const contacts = results.map(c => ({
      ...c,
      tags: JSON.parse(c.tags_json || '[]'),
      tags_json: undefined,
    }));
    
    return addCORSHeaders(successResponse({ contacts }), env);
  } catch (error) {
    console.error('Get contacts error:', error);
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
    const { email, first_name, last_name, tags } = body;
    
    // Validate input
    if (!email) {
      return addCORSHeaders(
        errorResponse('Invalid input', 'Email is required'),
        env
      );
    }
    
    if (!isValidEmail(email)) {
      return addCORSHeaders(
        errorResponse('Invalid email', 'Please provide a valid email address'),
        env
      );
    }
    
    // Check if contact already exists for this user
    const existing = await env.DB
      .prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?')
      .bind(auth.user.id, email.toLowerCase())
      .first();
    
    if (existing) {
      return addCORSHeaders(
        errorResponse('Contact exists', 'A contact with this email already exists'),
        env
      );
    }
    
    // Create contact
    const contactId = generateId();
    const tagsJson = JSON.stringify(tags || []);
    
    await env.DB
      .prepare('INSERT INTO contacts (id, user_id, email, first_name, last_name, tags_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(
        contactId,
        auth.user.id,
        email.toLowerCase(),
        first_name || null,
        last_name || null,
        tagsJson,
        now()
      )
      .run();
    
    // Log event
    await logEvent(env.DB, auth.user.id, 'contact.created', { contact_id: contactId, email });
    
    const contact = {
      id: contactId,
      email: email.toLowerCase(),
      first_name: first_name || null,
      last_name: last_name || null,
      tags: tags || [],
      created_at: now(),
    };
    
    return addCORSHeaders(successResponse({ contact }), env);
  } catch (error) {
    console.error('Create contact error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
