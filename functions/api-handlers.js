// All remaining handler implementations
// This file exports all handler functions used in the main router

export { handleSignup, handleLogin, handleLogout } from './handlers/auth.js';
export { getContacts, getContact, createContact, updateContact, deleteContact } from './handlers/contacts.js';
export { getLists, getList, createList, deleteList, importContacts, addContactsToList } from './handlers/lists.js';

import { generateId, errorResponse, successResponse, encryptData, decryptData } from './utils.js';

// ============================================
// INBOXES / OAUTH HANDLERS
// ============================================

export async function getInboxes(user, env) {
  try {
    const inboxes = await env.DB.prepare(
      'SELECT id, org_id, provider, email, display_name, status, daily_limit, per_hour_limit, min_delay_sec, created_at FROM inboxes WHERE org_id = ? ORDER BY created_at DESC'
    ).bind(user.org_id).all();

    return successResponse({ inboxes: inboxes.results });
  } catch (error) {
    console.error('Get inboxes error:', error);
    return errorResponse('Failed to fetch inboxes', 500, error.message);
  }
}

export async function initiateGoogleOAuth(user, env) {
  const redirectUri = `${env.APP_ORIGIN}/oauth/google/callback`;
  const state = `${user.id}:${user.org_id}:${generateId()}`;
  
  // Store state in KV for verification
  await env.KV_CACHE.put(`oauth_state:${state}`, JSON.stringify({ user_id: user.id, org_id: user.org_id }), {
    expirationTtl: 600 // 10 minutes
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return successResponse({ auth_url: authUrl.toString() });
}

export async function initiateMicrosoftOAuth(user, env) {
  const redirectUri = `${env.APP_ORIGIN}/oauth/microsoft/callback`;
  const state = `${user.id}:${user.org_id}:${generateId()}`;
  
  // Store state in KV for verification
  await env.KV_CACHE.put(`oauth_state:${state}`, JSON.stringify({ user_id: user.id, org_id: user.org_id }), {
    expirationTtl: 600 // 10 minutes
  });

  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.set('client_id', env.MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access');
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('state', state);

  return successResponse({ auth_url: authUrl.toString() });
}

export async function updateInbox(user, env, id, request) {
  try {
    const inbox = await env.DB.prepare(
      'SELECT * FROM inboxes WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!inbox) {
      return errorResponse('Inbox not found', 404);
    }

    const body = await request.json();
    const { status, daily_limit, per_hour_limit, min_delay_sec } = body;

    await env.DB.prepare(
      'UPDATE inboxes SET status = ?, daily_limit = ?, per_hour_limit = ?, min_delay_sec = ? WHERE id = ? AND org_id = ?'
    ).bind(
      status !== undefined ? status : inbox.status,
      daily_limit !== undefined ? daily_limit : inbox.daily_limit,
      per_hour_limit !== undefined ? per_hour_limit : inbox.per_hour_limit,
      min_delay_sec !== undefined ? min_delay_sec : inbox.min_delay_sec,
      id,
      user.org_id
    ).run();

    return successResponse({ message: 'Inbox updated successfully' });
  } catch (error) {
    console.error('Update inbox error:', error);
    return errorResponse('Failed to update inbox', 500, error.message);
  }
}

export async function deleteInbox(user, env, id) {
  try {
    const inbox = await env.DB.prepare(
      'SELECT * FROM inboxes WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!inbox) {
      return errorResponse('Inbox not found', 404);
    }

    await env.DB.prepare(
      'DELETE FROM inboxes WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'inbox.deleted',
      'inbox',
      id,
      JSON.stringify({ email: inbox.email }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ message: 'Inbox deleted successfully' });
  } catch (error) {
    console.error('Delete inbox error:', error);
    return errorResponse('Failed to delete inbox', 500, error.message);
  }
}

// ============================================
// SEQUENCES HANDLERS
// ============================================

export async function getSequences(user, env) {
  try {
    const sequences = await env.DB.prepare(
      'SELECT s.*, COUNT(DISTINCT e.id) as enrollment_count FROM sequences s LEFT JOIN enrollments e ON s.id = e.sequence_id WHERE s.org_id = ? GROUP BY s.id ORDER BY s.created_at DESC'
    ).bind(user.org_id).all();

    return successResponse({ sequences: sequences.results });
  } catch (error) {
    console.error('Get sequences error:', error);
    return errorResponse('Failed to fetch sequences', 500, error.message);
  }
}

export async function getSequence(user, env, id) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    const steps = await env.DB.prepare(
      'SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_index'
    ).bind(id).all();

    return successResponse({ ...sequence, steps: steps.results });
  } catch (error) {
    console.error('Get sequence error:', error);
    return errorResponse('Failed to fetch sequence', 500, error.message);
  }
}

export async function createSequence(user, env, request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return errorResponse('Sequence name is required');
    }

    const sequenceId = generateId();
    await env.DB.prepare(
      'INSERT INTO sequences (id, org_id, name, status, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      sequenceId,
      user.org_id,
      name,
      'draft',
      Math.floor(Date.now() / 1000)
    ).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'sequence.created',
      'sequence',
      sequenceId,
      JSON.stringify({ name }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ id: sequenceId, message: 'Sequence created successfully' });
  } catch (error) {
    console.error('Create sequence error:', error);
    return errorResponse('Failed to create sequence', 500, error.message);
  }
}

export async function updateSequence(user, env, id, request) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    const body = await request.json();
    const { name, status } = body;

    await env.DB.prepare(
      'UPDATE sequences SET name = ?, status = ? WHERE id = ? AND org_id = ?'
    ).bind(
      name || sequence.name,
      status || sequence.status,
      id,
      user.org_id
    ).run();

    return successResponse({ message: 'Sequence updated successfully' });
  } catch (error) {
    console.error('Update sequence error:', error);
    return errorResponse('Failed to update sequence', 500, error.message);
  }
}

export async function deleteSequence(user, env, id) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    await env.DB.prepare(
      'DELETE FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'sequence.deleted',
      'sequence',
      id,
      JSON.stringify({ name: sequence.name }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ message: 'Sequence deleted successfully' });
  } catch (error) {
    console.error('Delete sequence error:', error);
    return errorResponse('Failed to delete sequence', 500, error.message);
  }
}

export async function getSequenceSteps(user, env, sequenceId) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(sequenceId, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    const steps = await env.DB.prepare(
      'SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_index'
    ).bind(sequenceId).all();

    return successResponse({ steps: steps.results });
  } catch (error) {
    console.error('Get sequence steps error:', error);
    return errorResponse('Failed to fetch sequence steps', 500, error.message);
  }
}

export async function createSequenceStep(user, env, sequenceId, request) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(sequenceId, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    const body = await request.json();
    const { subject, html, text, wait_days } = body;

    if (!subject || (!html && !text)) {
      return errorResponse('Subject and message content are required');
    }

    // Get next step index
    const maxStep = await env.DB.prepare(
      'SELECT MAX(step_index) as max_idx FROM sequence_steps WHERE sequence_id = ?'
    ).bind(sequenceId).first();

    const stepIndex = (maxStep?.max_idx ?? -1) + 1;

    const stepId = generateId();
    await env.DB.prepare(
      'INSERT INTO sequence_steps (id, sequence_id, step_index, type, subject, html, text, wait_days, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      stepId,
      sequenceId,
      stepIndex,
      'email',
      subject,
      html || null,
      text || null,
      wait_days || 0,
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ id: stepId, message: 'Step added successfully' });
  } catch (error) {
    console.error('Create sequence step error:', error);
    return errorResponse('Failed to create sequence step', 500, error.message);
  }
}

export async function deleteSequenceStep(user, env, sequenceId, stepId) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(sequenceId, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    await env.DB.prepare(
      'DELETE FROM sequence_steps WHERE id = ? AND sequence_id = ?'
    ).bind(stepId, sequenceId).run();

    return successResponse({ message: 'Step deleted successfully' });
  } catch (error) {
    console.error('Delete sequence step error:', error);
    return errorResponse('Failed to delete sequence step', 500, error.message);
  }
}

export async function enrollInSequence(user, env, sequenceId, request) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(sequenceId, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    const body = await request.json();
    const { list_id, contact_ids, start_at } = body;

    let contactIdsToEnroll = [];

    if (list_id) {
      const listContacts = await env.DB.prepare(
        'SELECT contact_id FROM list_members WHERE list_id = ?'
      ).bind(list_id).all();
      contactIdsToEnroll = listContacts.results.map(r => r.contact_id);
    } else if (contact_ids && Array.isArray(contact_ids)) {
      contactIdsToEnroll = contact_ids;
    } else {
      return errorResponse('Either list_id or contact_ids is required');
    }

    if (contactIdsToEnroll.length === 0) {
      return errorResponse('No contacts to enroll');
    }

    const startTime = start_at ? new Date(start_at).getTime() / 1000 : Math.floor(Date.now() / 1000);
    let enrolled = 0;

    for (const contactId of contactIdsToEnroll) {
      // Check if contact belongs to org
      const contact = await env.DB.prepare(
        'SELECT id, email FROM contacts WHERE id = ? AND org_id = ?'
      ).bind(contactId, user.org_id).first();

      if (!contact) continue;

      // Check if already enrolled
      const existing = await env.DB.prepare(
        'SELECT id FROM enrollments WHERE sequence_id = ? AND contact_id = ? AND status NOT IN (?, ?)'
      ).bind(sequenceId, contactId, 'completed', 'unsubscribed').first();

      if (existing) continue;

      // Check suppression
      const suppressed = await env.DB.prepare(
        'SELECT id FROM suppression WHERE org_id = ? AND email = ?'
      ).bind(user.org_id, contact.email).first();

      if (suppressed) continue;

      // Check unsubscribes
      const unsubscribed = await env.DB.prepare(
        'SELECT id FROM unsubscribes WHERE org_id = ? AND email = ?'
      ).bind(user.org_id, contact.email).first();

      if (unsubscribed) continue;

      // Enroll
      const enrollmentId = generateId();
      await env.DB.prepare(
        'INSERT INTO enrollments (id, org_id, sequence_id, contact_id, status, current_step, next_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        enrollmentId,
        user.org_id,
        sequenceId,
        contactId,
        'active',
        0,
        Math.floor(startTime),
        Math.floor(Date.now() / 1000)
      ).run();

      enrolled++;
    }

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'sequence.enrolled',
      'sequence',
      sequenceId,
      JSON.stringify({ enrolled }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({
      message: `${enrolled} contacts enrolled successfully`,
      enrolled
    });
  } catch (error) {
    console.error('Enroll in sequence error:', error);
    return errorResponse('Failed to enroll contacts', 500, error.message);
  }
}

export async function getSequenceStatus(user, env, sequenceId) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(sequenceId, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    const stats = await env.DB.prepare(
      `SELECT 
        status,
        COUNT(*) as count
      FROM enrollments
      WHERE sequence_id = ?
      GROUP BY status`
    ).bind(sequenceId).all();

    const statusMap = {};
    stats.results.forEach(s => {
      statusMap[s.status] = s.count;
    });

    return successResponse({ stats: statusMap });
  } catch (error) {
    console.error('Get sequence status error:', error);
    return errorResponse('Failed to fetch sequence status', 500, error.message);
  }
}

// Additional handlers will be implemented as needed
// For now, returning placeholder responses for remaining endpoints

export async function sendTestEmail(user, env, request) {
  return errorResponse('Not implemented yet - requires OAuth setup', 501);
}

export async function startSending(user, env) {
  return errorResponse('Not implemented yet - requires Durable Object setup', 501);
}

export async function pauseSending(user, env) {
  return errorResponse('Not implemented yet - requires Durable Object setup', 501);
}

export async function getSendingStatus(user, env) {
  return successResponse({ status: 'paused', message: 'Sending engine not yet configured' });
}

export async function getAnalyticsOverview(user, env, request) {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || '7d';
    
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 7;
    const since = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

    const stats = await env.DB.prepare(
      `SELECT 
        COUNT(DISTINCT CASE WHEN status = 'sent' THEN id END) as sent,
        COUNT(DISTINCT CASE WHEN status = 'delivered' THEN id END) as delivered,
        COUNT(DISTINCT CASE WHEN opened_at IS NOT NULL THEN id END) as opened,
        COUNT(DISTINCT CASE WHEN clicked_at IS NOT NULL THEN id END) as clicked,
        COUNT(DISTINCT CASE WHEN replied_at IS NOT NULL THEN id END) as replied,
        COUNT(DISTINCT CASE WHEN status = 'bounced' THEN id END) as bounced
      FROM messages
      WHERE org_id = ? AND created_at >= ?`
    ).bind(user.org_id, since).first();

    return successResponse({ stats });
  } catch (error) {
    console.error('Get analytics overview error:', error);
    return errorResponse('Failed to fetch analytics', 500, error.message);
  }
}

export async function getSequenceAnalytics(user, env, sequenceId) {
  try {
    const sequence = await env.DB.prepare(
      'SELECT * FROM sequences WHERE id = ? AND org_id = ?'
    ).bind(sequenceId, user.org_id).first();

    if (!sequence) {
      return errorResponse('Sequence not found', 404);
    }

    const stats = await env.DB.prepare(
      `SELECT 
        COUNT(DISTINCT m.id) as sent,
        COUNT(DISTINCT CASE WHEN m.opened_at IS NOT NULL THEN m.id END) as opened,
        COUNT(DISTINCT CASE WHEN m.clicked_at IS NOT NULL THEN m.id END) as clicked,
        COUNT(DISTINCT CASE WHEN m.replied_at IS NOT NULL THEN m.id END) as replied
      FROM messages m
      JOIN enrollments e ON m.enrollment_id = e.id
      WHERE e.sequence_id = ?`
    ).bind(sequenceId).first();

    return successResponse({ stats });
  } catch (error) {
    console.error('Get sequence analytics error:', error);
    return errorResponse('Failed to fetch sequence analytics', 500, error.message);
  }
}

export async function getEvents(user, env, request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    const events = await env.DB.prepare(
      'SELECT * FROM events WHERE org_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(user.org_id, limit).all();

    return successResponse({
      events: events.results.map(e => ({
        ...e,
        payload: JSON.parse(e.payload_json || '{}')
      }))
    });
  } catch (error) {
    console.error('Get events error:', error);
    return errorResponse('Failed to fetch events', 500, error.message);
  }
}

export async function getSuppression(user, env) {
  try {
    const suppression = await env.DB.prepare(
      'SELECT * FROM suppression WHERE org_id = ? ORDER BY created_at DESC'
    ).bind(user.org_id).all();

    return successResponse({ suppression: suppression.results });
  } catch (error) {
    console.error('Get suppression error:', error);
    return errorResponse('Failed to fetch suppression list', 500, error.message);
  }
}

export async function addSuppression(user, env, request) {
  try {
    const body = await request.json();
    const { email, type, reason } = body;

    if (!email || !type) {
      return errorResponse('Email and type are required');
    }

    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO suppression (id, org_id, email, type, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      user.org_id,
      email,
      type,
      reason || null,
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ message: 'Email added to suppression list' });
  } catch (error) {
    console.error('Add suppression error:', error);
    return errorResponse('Failed to add to suppression list', 500, error.message);
  }
}

export async function getSites(user, env) {
  try {
    const sites = await env.DB.prepare(
      'SELECT id, org_id, name, allowed_domains_json, created_at FROM sites WHERE org_id = ? ORDER BY created_at DESC'
    ).bind(user.org_id).all();

    return successResponse({
      sites: sites.results.map(s => ({
        ...s,
        allowed_domains: JSON.parse(s.allowed_domains_json || '[]')
      }))
    });
  } catch (error) {
    console.error('Get sites error:', error);
    return errorResponse('Failed to fetch sites', 500, error.message);
  }
}

export async function createSite(user, env, request) {
  try {
    const body = await request.json();
    const { name, allowed_domains } = body;

    if (!name || !allowed_domains || !Array.isArray(allowed_domains) || allowed_domains.length === 0) {
      return errorResponse('Name and allowed_domains array are required');
    }

    const siteId = generateId();
    const pixelSecret = generateId();

    await env.DB.prepare(
      'INSERT INTO sites (id, org_id, name, allowed_domains_json, pixel_secret, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      siteId,
      user.org_id,
      name,
      JSON.stringify(allowed_domains),
      pixelSecret,
      Math.floor(Date.now() / 1000)
    ).run();

    const snippet = `<script async src="${env.APP_ORIGIN}/p/${siteId}.js"></script>`;

    return successResponse({
      id: siteId,
      message: 'Site created successfully',
      snippet
    });
  } catch (error) {
    console.error('Create site error:', error);
    return errorResponse('Failed to create site', 500, error.message);
  }
}

export async function getSite(user, env, id) {
  try {
    const site = await env.DB.prepare(
      'SELECT * FROM sites WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!site) {
      return errorResponse('Site not found', 404);
    }

    const snippet = `<script async src="${env.APP_ORIGIN}/p/${site.id}.js"></script>`;

    return successResponse({
      ...site,
      allowed_domains: JSON.parse(site.allowed_domains_json || '[]'),
      snippet
    });
  } catch (error) {
    console.error('Get site error:', error);
    return errorResponse('Failed to fetch site', 500, error.message);
  }
}

export async function deleteSite(user, env, id) {
  try {
    const site = await env.DB.prepare(
      'SELECT * FROM sites WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).first();

    if (!site) {
      return errorResponse('Site not found', 404);
    }

    await env.DB.prepare(
      'DELETE FROM sites WHERE id = ? AND org_id = ?'
    ).bind(id, user.org_id).run();

    return successResponse({ message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Delete site error:', error);
    return errorResponse('Failed to delete site', 500, error.message);
  }
}

export async function getSiteStats(user, env, siteId, request) {
  try {
    const site = await env.DB.prepare(
      'SELECT * FROM sites WHERE id = ? AND org_id = ?'
    ).bind(siteId, user.org_id).first();

    if (!site) {
      return errorResponse('Site not found', 404);
    }

    const url = new URL(request.url);
    const range = url.searchParams.get('range') || '24h';
    
    const hoursMap = { '24h': 24, '7d': 168, '30d': 720 };
    const hours = hoursMap[range] || 24;
    const since = Math.floor(Date.now() / 1000) - (hours * 60 * 60);

    const stats = await env.DB.prepare(
      `SELECT 
        COUNT(*) as pageviews,
        COUNT(DISTINCT anon_id) as unique_visitors,
        COUNT(DISTINCT url) as unique_pages
      FROM pixel_events
      WHERE site_id = ? AND ts >= ?`
    ).bind(siteId, since).first();

    const topPages = await env.DB.prepare(
      `SELECT url, COUNT(*) as views
      FROM pixel_events
      WHERE site_id = ? AND ts >= ?
      GROUP BY url
      ORDER BY views DESC
      LIMIT 10`
    ).bind(siteId, since).all();

    const topReferrers = await env.DB.prepare(
      `SELECT referrer, COUNT(*) as count
      FROM pixel_events
      WHERE site_id = ? AND ts >= ? AND referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 10`
    ).bind(siteId, since).all();

    return successResponse({
      stats,
      top_pages: topPages.results,
      top_referrers: topReferrers.results
    });
  } catch (error) {
    console.error('Get site stats error:', error);
    return errorResponse('Failed to fetch site stats', 500, error.message);
  }
}

export async function collectPixelEvent(request, env) {
  // This will be called from the pixel collection endpoint
  // Implementation in the main handler file
  return errorResponse('Not implemented', 501);
}
