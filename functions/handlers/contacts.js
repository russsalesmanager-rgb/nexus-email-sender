// Contacts handlers

import { generateId, errorResponse, successResponse } from '../utils.js';

export async function getContacts(user, env, request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';

    let query = 'SELECT * FROM contacts WHERE org_id = ?';
    const params = [user.org_id];

    if (search) {
      query += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const contacts = await env.DB.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM contacts WHERE org_id = ?';
    const countParams = [user.org_id];
    if (search) {
      countQuery += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    return successResponse({
      contacts: contacts.results.map(c => ({
        ...c,
        tags: JSON.parse(c.tags_json || '[]'),
        custom: JSON.parse(c.custom_json || '{}')
      })),
      total: countResult.total,
      page,
      limit
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    return errorResponse('Failed to fetch contacts', 500, error.message);
  }
}

export async function getContact(user, env, id) {
  try {
    const contact = await env.DB.prepare(
      'SELECT * FROM contacts WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!contact) {
      return errorResponse('Contact not found', 404);
    }

    return successResponse({
      ...contact,
      tags: JSON.parse(contact.tags_json || '[]'),
      custom: JSON.parse(contact.custom_json || '{}')
    });
  } catch (error) {
    console.error('Get contact error:', error);
    return errorResponse('Failed to fetch contact', 500, error.message);
  }
}

export async function createContact(user, env, request) {
  try {
    const body = await request.json();
    const { email, first_name, last_name, company, title, phone, tags, custom } = body;

    if (!email) {
      return errorResponse('Email is required');
    }

    // Check for duplicate
    const existing = await env.DB.prepare(
      'SELECT id FROM contacts WHERE org_id = ? AND email = ?'
    ).bind(user.org_id, email).first();

    if (existing) {
      return errorResponse('Contact with this email already exists');
    }

    const contactId = generateId();
    await env.DB.prepare(
      'INSERT INTO contacts (id, org_id, email, first_name, last_name, company, title, phone, tags_json, custom_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      contactId,
      user.org_id,
      email,
      first_name || null,
      last_name || null,
      company || null,
      title || null,
      phone || null,
      JSON.stringify(tags || []),
      JSON.stringify(custom || {}),
      Math.floor(Date.now() / 1000)
    ).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'contact.created',
      'contact',
      contactId,
      JSON.stringify({ email }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ id: contactId, message: 'Contact created successfully' });
  } catch (error) {
    console.error('Create contact error:', error);
    return errorResponse('Failed to create contact', 500, error.message);
  }
}

export async function updateContact(user, env, id, request) {
  try {
    const contact = await env.DB.prepare(
      'SELECT * FROM contacts WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!contact) {
      return errorResponse('Contact not found', 404);
    }

    const body = await request.json();
    const { email, first_name, last_name, company, title, phone, tags, custom } = body;

    await env.DB.prepare(
      'UPDATE contacts SET email = ?, first_name = ?, last_name = ?, company = ?, title = ?, phone = ?, tags_json = ?, custom_json = ? WHERE id = ? AND org_id = ?'
    ).bind(
      email || contact.email,
      first_name !== undefined ? first_name : contact.first_name,
      last_name !== undefined ? last_name : contact.last_name,
      company !== undefined ? company : contact.company,
      title !== undefined ? title : contact.title,
      phone !== undefined ? phone : contact.phone,
      tags ? JSON.stringify(tags) : contact.tags_json,
      custom ? JSON.stringify(custom) : contact.custom_json,
      id,
      user.org_id
    ).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'contact.updated',
      'contact',
      id,
      JSON.stringify({ email: email || contact.email }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ message: 'Contact updated successfully' });
  } catch (error) {
    console.error('Update contact error:', error);
    return errorResponse('Failed to update contact', 500, error.message);
  }
}

export async function deleteContact(user, env, id) {
  try {
    const contact = await env.DB.prepare(
      'SELECT * FROM contacts WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!contact) {
      return errorResponse('Contact not found', 404);
    }

    await env.DB.prepare(
      'DELETE FROM contacts WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'contact.deleted',
      'contact',
      id,
      JSON.stringify({ email: contact.email }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    return errorResponse('Failed to delete contact', 500, error.message);
  }
}
