// POST /api/contacts/import - Import contacts from CSV

import { jsonResponse, errorResponse, unauthorizedResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { requireAuth, generateId } from '../../lib/auth.js';
import { isValidEmail, sanitize, logEvent } from '../../lib/db.js';

function parseCSV(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length === 0) return [];
    
    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const contacts = [];
    
    // Parse rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim());
        const contact = {};
        
        header.forEach((col, index) => {
            if (values[index]) {
                contact[col] = values[index];
            }
        });
        
        // Must have email
        if (contact.email && isValidEmail(contact.email)) {
            contacts.push({
                email: contact.email.toLowerCase(),
                first_name: contact.first_name || contact.firstname || '',
                last_name: contact.last_name || contact.lastname || '',
            });
        }
    }
    
    return contacts;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;
    
    try {
        const { authorized, user } = await requireAuth(request, env);
        if (!authorized) {
            return addCorsHeaders(
                addSecurityHeaders(unauthorizedResponse()),
                env.APP_ORIGIN
            );
        }
        
        const body = await request.json();
        const csvData = body.csvData;
        
        if (!csvData) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('CSV data is required')),
                env.APP_ORIGIN
            );
        }
        
        const contacts = parseCSV(csvData);
        
        if (contacts.length === 0) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('No valid contacts found in CSV')),
                env.APP_ORIGIN
            );
        }
        
        // Import contacts (skip duplicates)
        let imported = 0;
        let skipped = 0;
        
        for (const contact of contacts) {
            try {
                // Check for duplicate
                const existing = await env.DB.prepare(
                    'SELECT id FROM contacts WHERE user_id = ? AND email = ?'
                ).bind(user.id, contact.email).first();
                
                if (existing) {
                    skipped++;
                    continue;
                }
                
                // Insert contact
                const contactId = generateId();
                await env.DB.prepare(`
                    INSERT INTO contacts (id, user_id, email, first_name, last_name, tags_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).bind(
                    contactId,
                    user.id,
                    contact.email,
                    contact.first_name,
                    contact.last_name,
                    '["imported"]'
                ).run();
                
                imported++;
            } catch (error) {
                console.error('Failed to import contact:', contact.email, error);
                skipped++;
            }
        }
        
        await logEvent(env.DB, user.id, 'contacts.imported', { imported, skipped, total: contacts.length });
        
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse({ 
                message: 'Import completed',
                count: imported,
                skipped,
                total: contacts.length 
            })),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Import contacts error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to import contacts', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
