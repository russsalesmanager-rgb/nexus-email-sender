// Lists handlers

import { generateId, errorResponse, successResponse } from '../utils.js';

export async function getLists(user, env) {
  try {
    const lists = await env.DB.prepare(
      'SELECT l.*, COUNT(lm.contact_id) as contact_count FROM lists l LEFT JOIN list_members lm ON l.id = lm.list_id WHERE l.org_id = ? GROUP BY l.id ORDER BY l.created_at DESC'
    ).bind(user.org_id).all();

    return successResponse({ lists: lists.results });
  } catch (error) {
    console.error('Get lists error:', error);
    return errorResponse('Failed to fetch lists', 500, error.message);
  }
}

export async function getList(user, env, id) {
  try {
    const list = await env.DB.prepare(
      'SELECT * FROM lists WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!list) {
      return errorResponse('List not found', 404);
    }

    // Get contacts in this list
    const contacts = await env.DB.prepare(
      'SELECT c.* FROM contacts c JOIN list_members lm ON c.id = lm.contact_id WHERE lm.list_id = ? ORDER BY lm.created_at DESC'
    ).bind(id).all();

    return successResponse({
      ...list,
      contacts: contacts.results.map(c => ({
        ...c,
        tags: JSON.parse(c.tags_json || '[]'),
        custom: JSON.parse(c.custom_json || '{}')
      }))
    });
  } catch (error) {
    console.error('Get list error:', error);
    return errorResponse('Failed to fetch list', 500, error.message);
  }
}

export async function createList(user, env, request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return errorResponse('List name is required');
    }

    const listId = generateId();
    await env.DB.prepare(
      'INSERT INTO lists (id, org_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      listId,
      user.org_id,
      name,
      description || null,
      Math.floor(Date.now() / 1000)
    ).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'list.created',
      'list',
      listId,
      JSON.stringify({ name }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ id: listId, message: 'List created successfully' });
  } catch (error) {
    console.error('Create list error:', error);
    return errorResponse('Failed to create list', 500, error.message);
  }
}

export async function deleteList(user, env, id) {
  try {
    const list = await env.DB.prepare(
      'SELECT * FROM lists WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!list) {
      return errorResponse('List not found', 404);
    }

    await env.DB.prepare(
      'DELETE FROM lists WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'list.deleted',
      'list',
      id,
      JSON.stringify({ name: list.name }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Delete list error:', error);
    return errorResponse('Failed to delete list', 500, error.message);
  }
}

export async function importContacts(user, env, listId, request) {
  try {
    const list = await env.DB.prepare(
      'SELECT * FROM lists WHERE id = ? AND org_id = ?'
    ).bind(listId, user.org_id).first();

    if (!list) {
      return errorResponse('List not found', 404);
    }

    const body = await request.json();
    const { csv, contacts: contactsArray } = body;

    let contacts = [];

    // Parse CSV if provided
    if (csv) {
      const lines = csv.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        return errorResponse('CSV must have at least a header row and one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIndex = headers.findIndex(h => h === 'email');

      if (emailIndex === -1) {
        return errorResponse('CSV must contain an "email" column');
      }

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const contact = {};
        
        headers.forEach((header, idx) => {
          if (values[idx]) {
            contact[header] = values[idx];
          }
        });

        if (contact.email) {
          contacts.push(contact);
        }
      }
    } else if (contactsArray && Array.isArray(contactsArray)) {
      contacts = contactsArray;
    } else {
      return errorResponse('Either csv or contacts array is required');
    }

    if (contacts.length === 0) {
      return errorResponse('No valid contacts found');
    }

    let imported = 0;
    let skipped = 0;

    for (const contact of contacts) {
      if (!contact.email) {
        skipped++;
        continue;
      }

      // Check if contact exists
      let existingContact = await env.DB.prepare(
        'SELECT id FROM contacts WHERE org_id = ? AND email = ?'
      ).bind(user.org_id, contact.email).first();

      let contactId;

      if (!existingContact) {
        // Create new contact
        contactId = generateId();
        await env.DB.prepare(
          'INSERT INTO contacts (id, org_id, email, first_name, last_name, company, title, phone, tags_json, custom_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          contactId,
          user.org_id,
          contact.email,
          contact.first_name || contact.firstname || null,
          contact.last_name || contact.lastname || null,
          contact.company || null,
          contact.title || null,
          contact.phone || null,
          JSON.stringify([]),
          JSON.stringify({}),
          Math.floor(Date.now() / 1000)
        ).run();
      } else {
        contactId = existingContact.id;
      }

      // Add to list (if not already in it)
      const inList = await env.DB.prepare(
        'SELECT 1 FROM list_members WHERE list_id = ? AND contact_id = ?'
      ).bind(listId, contactId).first();

      if (!inList) {
        await env.DB.prepare(
          'INSERT INTO list_members (list_id, contact_id, created_at) VALUES (?, ?, ?)'
        ).bind(listId, contactId, Math.floor(Date.now() / 1000)).run();
        imported++;
      } else {
        skipped++;
      }
    }

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'list.import',
      'list',
      listId,
      JSON.stringify({ imported, skipped }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({
      message: `Import complete. ${imported} contacts added, ${skipped} skipped.`,
      imported,
      skipped
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    return errorResponse('Failed to import contacts', 500, error.message);
  }
}

export async function addContactsToList(user, env, listId, request) {
  try {
    const list = await env.DB.prepare(
      'SELECT * FROM lists WHERE id = ? AND org_id = ?'
    ).bind(listId, user.org_id).first();

    if (!list) {
      return errorResponse('List not found', 404);
    }

    const body = await request.json();
    const { contact_ids } = body;

    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return errorResponse('contact_ids array is required');
    }

    let added = 0;
    let skipped = 0;

    for (const contactId of contact_ids) {
      // Verify contact exists and belongs to org
      const contact = await env.DB.prepare(
        'SELECT id FROM contacts WHERE id = ? AND org_id = ?'
      ).bind(contactId, user.org_id).first();

      if (!contact) {
        skipped++;
        continue;
      }

      // Check if already in list
      const inList = await env.DB.prepare(
        'SELECT 1 FROM list_members WHERE list_id = ? AND contact_id = ?'
      ).bind(listId, contactId).first();

      if (!inList) {
        await env.DB.prepare(
          'INSERT INTO list_members (list_id, contact_id, created_at) VALUES (?, ?, ?)'
        ).bind(listId, contactId, Math.floor(Date.now() / 1000)).run();
        added++;
      } else {
        skipped++;
      }
    }

    return successResponse({
      message: `${added} contacts added, ${skipped} skipped.`,
      added,
      skipped
    });
  } catch (error) {
    console.error('Add contacts to list error:', error);
    return errorResponse('Failed to add contacts to list', 500, error.message);
  }
}
