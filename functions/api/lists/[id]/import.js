// POST /api/lists/:id/import - Import contacts from CSV
import { requireAuth, handleCORS, addCORSHeaders } from '../../../_shared/auth.js';
import {
  generateId,
  now,
  isValidEmail,
  successResponse,
  errorResponse,
  logEvent,
} from '../../../_shared/utils.js';

export async function onRequestPost(context) {
  const { request, env, params } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  // Require authentication
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    // Check if list exists
    const list = await env.DB
      .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!list) {
      return addCORSHeaders(
        errorResponse('Not found', 'List not found', 404),
        env
      );
    }
    
    const body = await request.json();
    const { csv } = body;
    
    if (!csv) {
      return addCORSHeaders(
        errorResponse('Invalid input', 'CSV data is required'),
        env
      );
    }
    
    // Parse CSV
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      return addCORSHeaders(
        errorResponse('Invalid CSV', 'CSV must have at least a header row and one data row'),
        env
      );
    }
    
    // Parse header to find email column
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIndex = header.findIndex(h => h === 'email' || h === 'e-mail' || h === 'email address');
    
    if (emailIndex === -1) {
      return addCORSHeaders(
        errorResponse('Invalid CSV', 'CSV must have an "email" column'),
        env
      );
    }
    
    const firstNameIndex = header.findIndex(h => h === 'first_name' || h === 'firstname' || h === 'first name');
    const lastNameIndex = header.findIndex(h => h === 'last_name' || h === 'lastname' || h === 'last name');
    
    let imported = 0;
    let skipped = 0;
    
    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(',').map(c => c.trim());
      const email = cols[emailIndex];
      
      if (!email || !isValidEmail(email)) {
        skipped++;
        continue;
      }
      
      const firstName = firstNameIndex !== -1 ? cols[firstNameIndex] : null;
      const lastName = lastNameIndex !== -1 ? cols[lastNameIndex] : null;
      
      // Check if contact already exists
      let contact = await env.DB
        .prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?')
        .bind(auth.user.id, email.toLowerCase())
        .first();
      
      // Create contact if doesn't exist
      if (!contact) {
        const contactId = generateId();
        await env.DB
          .prepare('INSERT INTO contacts (id, user_id, email, first_name, last_name, tags_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(contactId, auth.user.id, email.toLowerCase(), firstName, lastName, '[]', now())
          .run();
        contact = { id: contactId };
      }
      
      // Check if already in list
      const existing = await env.DB
        .prepare('SELECT 1 FROM list_members WHERE list_id = ? AND contact_id = ?')
        .bind(params.id, contact.id)
        .first();
      
      if (!existing) {
        // Add to list
        await env.DB
          .prepare('INSERT INTO list_members (list_id, contact_id, created_at) VALUES (?, ?, ?)')
          .bind(params.id, contact.id, now())
          .run();
        imported++;
      } else {
        skipped++;
      }
    }
    
    // Log event
    await logEvent(env.DB, auth.user.id, 'list.import', {
      list_id: params.id,
      imported,
      skipped,
    });
    
    return addCORSHeaders(
      successResponse({
        message: 'CSV imported successfully',
        imported,
        skipped,
      }),
      env
    );
  } catch (error) {
    console.error('Import CSV error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
