/**
 * POST /api/lists/:id/import-csv
 * Import contacts from CSV data into a list
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail } from '../../../utils.js';
import { generateUUID } from '../../../crypto.js';

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        rows.push(row);
    }
    
    return rows;
}

export async function onRequestPost(context) {
    const { request, env, params, data } = context;
    const user = data.user;
    const listId = params.id;
    
    try {
        const body = await parseBody(request);
        const { csv } = body;
        
        if (!csv) {
            return errorResponse('CSV content is required', 400);
        }
        
        // Check list exists and belongs to user
        const list = await env.DB
            .prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?')
            .bind(listId, user.id)
            .first();
        
        if (!list) {
            return errorResponse('List not found', 404);
        }
        
        // Parse CSV
        const rows = parseCSV(csv);
        
        if (rows.length === 0) {
            return errorResponse('No valid rows found in CSV', 400);
        }
        
        let imported = 0;
        let skipped = 0;
        
        for (const row of rows) {
            const email = row.email || row.emailaddress || '';
            const firstName = row.first_name || row.firstname || row.name || '';
            const lastName = row.last_name || row.lastname || '';
            
            if (!email || !isValidEmail(email)) {
                skipped++;
                continue;
            }
            
            // Check if contact already exists
            let contact = await env.DB
                .prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?')
                .bind(user.id, email.toLowerCase())
                .first();
            
            // Create contact if it doesn't exist
            if (!contact) {
                const contactId = generateUUID();
                
                await env.DB
                    .prepare(`
                        INSERT INTO contacts (id, user_id, email, first_name, last_name, tags_json)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `)
                    .bind(contactId, user.id, email.toLowerCase(), firstName || null, lastName || null, '[]')
                    .run();
                
                contact = { id: contactId };
            }
            
            // Add contact to list (ignore if already in list)
            try {
                await env.DB
                    .prepare(`
                        INSERT INTO list_members (list_id, contact_id)
                        VALUES (?, ?)
                    `)
                    .bind(listId, contact.id)
                    .run();
                
                imported++;
            } catch (error) {
                // Probably already in list (unique constraint)
                if (error.message && error.message.includes('UNIQUE')) {
                    skipped++;
                } else {
                    throw error;
                }
            }
        }
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(
                generateUUID(),
                user.id,
                'list.csv_import',
                JSON.stringify({ listId, imported, skipped })
            )
            .run();
        
        return jsonResponse({
            success: true,
            imported,
            skipped,
            total: rows.length
        });
    } catch (error) {
        console.error('CSV import error:', error);
        return errorResponse('Internal server error', 500);
    }
}
