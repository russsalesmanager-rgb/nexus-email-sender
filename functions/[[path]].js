// Cloudflare Pages Functions - Main Entry Point
// This handles all routes: /api/*, /oauth/*, /p/*, /u/*, /t/*

import {
  generateId,
  getCurrentUser,
  jsonResponse,
  errorResponse,
  successResponse,
  hashIP,
  hmacSign,
  hmacVerify,
  checkRateLimit,
  encryptData,
  decryptData
} from './utils.js';

// Import all API handlers
import * as handlers from './api-handlers.js';

// Export Durable Object
export { SendCoordinator } from './durable-objects/SendCoordinator.js';

// Main request handler
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    // Route handling
    if (path.startsWith('/api/')) {
      return await handleAPI(request, env, path, method);
    } else if (path.startsWith('/oauth/')) {
      return await handleOAuth(request, env, path);
    } else if (path.startsWith('/p/')) {
      return await handlePixel(request, env, path);
    } else if (path.startsWith('/u/')) {
      return await handleUnsubscribe(request, env, url);
    } else if (path.startsWith('/t/')) {
      return await handleTracking(request, env, path);
    }

    // Not found
    return errorResponse('Not Found', 404);
  } catch (error) {
    console.error('Request error:', error);
    return errorResponse('Internal Server Error', 500, error.message);
  }
}

// ============================================
// API HANDLERS
// ============================================

async function handleAPI(request, env, path, method) {
  // Health check
  if (path === '/api/health') {
    return successResponse({ status: 'ok', timestamp: Date.now() });
  }

  // Auth endpoints (no auth required)
  if (path === '/api/auth/signup' && method === 'POST') {
    return await handlers.handleSignup(request, env);
  }
  if (path === '/api/auth/login' && method === 'POST') {
    return await handlers.handleLogin(request, env);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return await handlers.handleLogout(request, env);
  }

  // All other endpoints require authentication
  const user = await getCurrentUser(request, env);
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  // User info
  if (path === '/api/me' && method === 'GET') {
    return successResponse(user);
  }

  // Contacts
  if (path === '/api/contacts' && method === 'GET') {
    return await handlers.getContacts(user, env, request);
  }
  if (path === '/api/contacts' && method === 'POST') {
    return await handlers.createContact(user, env, request);
  }
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await handlers.getContact(user, env, id);
  }
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    return await handlers.updateContact(user, env, id, request);
  }
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await handlers.deleteContact(user, env, id);
  }

  // Lists
  if (path === '/api/lists' && method === 'GET') {
    return await handlers.getLists(user, env);
  }
  if (path === '/api/lists' && method === 'POST') {
    return await handlers.createList(user, env, request);
  }
  if (path.match(/^\/api\/lists\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await handlers.getList(user, env, id);
  }
  if (path.match(/^\/api\/lists\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await handlers.deleteList(user, env, id);
  }
  if (path.match(/^\/api\/lists\/[^/]+\/import$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await handlers.importContacts(user, env, id, request);
  }
  if (path.match(/^\/api\/lists\/[^/]+\/add-contacts$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await handlers.addContactsToList(user, env, id, request);
  }

  // Inboxes
  if (path === '/api/inboxes' && method === 'GET') {
    return await handlers.getInboxes(user, env);
  }
  if (path === '/api/inboxes/connect/google' && method === 'POST') {
    return await handlers.initiateGoogleOAuth(user, env);
  }
  if (path === '/api/inboxes/connect/microsoft' && method === 'POST') {
    return await handlers.initiateMicrosoftOAuth(user, env);
  }
  if (path.match(/^\/api\/inboxes\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    return await handlers.updateInbox(user, env, id, request);
  }
  if (path.match(/^\/api\/inboxes\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await handlers.deleteInbox(user, env, id);
  }

  // Sequences
  if (path === '/api/sequences' && method === 'GET') {
    return await handlers.getSequences(user, env);
  }
  if (path === '/api/sequences' && method === 'POST') {
    return await handlers.createSequence(user, env, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await handlers.getSequence(user, env, id);
  }
  if (path.match(/^\/api\/sequences\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    return await handlers.updateSequence(user, env, id, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await handlers.deleteSequence(user, env, id);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/steps$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await handlers.getSequenceSteps(user, env, id);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/steps$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await handlers.createSequenceStep(user, env, id, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/steps\/[^/]+$/) && method === 'DELETE') {
    const [, , , seqId, , stepId] = path.split('/');
    return await handlers.deleteSequenceStep(user, env, seqId, stepId);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/enroll$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await handlers.enrollInSequence(user, env, id, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/status$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await handlers.getSequenceStatus(user, env, id);
  }

  // Sending
  if (path === '/api/send/test' && method === 'POST') {
    return await handlers.sendTestEmail(user, env, request);
  }
  if (path === '/api/sending/start' && method === 'POST') {
    return await handlers.startSending(user, env);
  }
  if (path === '/api/sending/pause' && method === 'POST') {
    return await handlers.pauseSending(user, env);
  }
  if (path === '/api/sending/status' && method === 'GET') {
    return await handlers.getSendingStatus(user, env);
  }

  // Analytics
  if (path === '/api/analytics/overview' && method === 'GET') {
    return await handlers.getAnalyticsOverview(user, env, request);
  }
  if (path.match(/^\/api\/analytics\/sequence\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[4];
    return await handlers.getSequenceAnalytics(user, env, id);
  }
  if (path === '/api/events' && method === 'GET') {
    return await handlers.getEvents(user, env, request);
  }

  // Suppression
  if (path === '/api/suppression' && method === 'GET') {
    return await handlers.getSuppression(user, env);
  }
  if (path === '/api/suppression' && method === 'POST') {
    return await handlers.addSuppression(user, env, request);
  }

  // Pixel/Sites
  if (path === '/api/pixel/sites' && method === 'GET') {
    return await handlers.getSites(user, env);
  }
  if (path === '/api/pixel/sites' && method === 'POST') {
    return await handlers.createSite(user, env, request);
  }
  if (path.match(/^\/api\/pixel\/sites\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[4];
    return await handlers.getSite(user, env, id);
  }
  if (path.match(/^\/api\/pixel\/sites\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[4];
    return await handlers.deleteSite(user, env, id);
  }
  if (path.match(/^\/api\/pixel\/sites\/[^/]+\/stats$/) && method === 'GET') {
    const id = path.split('/')[4];
    return await handlers.getSiteStats(user, env, id, request);
  }
  if (path === '/api/pixel/collect' && method === 'POST') {
    return await collectPixelEvent(request, env);
  }

  return errorResponse('Not Found', 404);
}

// ============================================
// OAUTH HANDLERS
// ============================================

async function handleOAuth(request, env, path) {
  // Google OAuth callback
  if (path === '/oauth/google/callback') {
    return await handleGoogleOAuthCallback(request, env);
  }

  // Microsoft OAuth callback
  if (path === '/oauth/microsoft/callback') {
    return await handleMicrosoftOAuthCallback(request, env);
  }

  return errorResponse('Not Found', 404);
}

async function handleGoogleOAuthCallback(request, env) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(`<html><body><script>window.close()</script><h1>Authorization cancelled</h1></body></html>`, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (!code || !state) {
      return errorResponse('Missing code or state parameter');
    }

    // Verify state
    const stateData = await env.KV_CACHE.get(`oauth_state:${state}`);
    if (!stateData) {
      return errorResponse('Invalid or expired state');
    }

    const { user_id, org_id } = JSON.parse(stateData);
    await env.KV_CACHE.delete(`oauth_state:${state}`);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.APP_ORIGIN}/oauth/google/callback`,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();
    
    if (!tokens.access_token) {
      return errorResponse('Failed to obtain access token', 500, JSON.stringify(tokens));
    }

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    const userInfo = await userInfoResponse.json();

    // Encrypt tokens
    const encryptedTokens = await encryptData(tokens, env.ENCRYPTION_KEY_B64);

    // Store inbox
    const inboxId = generateId();
    await env.DB.prepare(
      'INSERT INTO inboxes (id, org_id, provider, email, display_name, oauth_json_encrypted, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      inboxId,
      org_id,
      'google',
      userInfo.email,
      userInfo.name || userInfo.email,
      encryptedTokens,
      'active',
      Math.floor(Date.now() / 1000)
    ).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      org_id,
      user_id,
      'inbox.connected',
      'inbox',
      inboxId,
      JSON.stringify({ provider: 'google', email: userInfo.email }),
      Math.floor(Date.now() / 1000)
    ).run();

    return new Response(`<html><body><script>window.opener.postMessage({type:'oauth_success',provider:'google'}, '*'); window.close()</script><h1>Connected successfully! You can close this window.</h1></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return new Response(`<html><body><script>window.close()</script><h1>Error: ${error.message}</h1></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

async function handleMicrosoftOAuthCallback(request, env) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(`<html><body><script>window.close()</script><h1>Authorization cancelled</h1></body></html>`, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (!code || !state) {
      return errorResponse('Missing code or state parameter');
    }

    // Verify state
    const stateData = await env.KV_CACHE.get(`oauth_state:${state}`);
    if (!stateData) {
      return errorResponse('Invalid or expired state');
    }

    const { user_id, org_id } = JSON.parse(stateData);
    await env.KV_CACHE.delete(`oauth_state:${state}`);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.MICROSOFT_CLIENT_ID,
        client_secret: env.MICROSOFT_CLIENT_SECRET,
        redirect_uri: `${env.APP_ORIGIN}/oauth/microsoft/callback`,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();
    
    if (!tokens.access_token) {
      return errorResponse('Failed to obtain access token', 500, JSON.stringify(tokens));
    }

    // Get user info
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    const userInfo = await userInfoResponse.json();

    // Encrypt tokens
    const encryptedTokens = await encryptData(tokens, env.ENCRYPTION_KEY_B64);

    // Store inbox
    const inboxId = generateId();
    await env.DB.prepare(
      'INSERT INTO inboxes (id, org_id, provider, email, display_name, oauth_json_encrypted, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      inboxId,
      org_id,
      'microsoft',
      userInfo.mail || userInfo.userPrincipalName,
      userInfo.displayName || userInfo.mail,
      encryptedTokens,
      'active',
      Math.floor(Date.now() / 1000)
    ).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      org_id,
      user_id,
      'inbox.connected',
      'inbox',
      inboxId,
      JSON.stringify({ provider: 'microsoft', email: userInfo.mail || userInfo.userPrincipalName }),
      Math.floor(Date.now() / 1000)
    ).run();

    return new Response(`<html><body><script>window.opener.postMessage({type:'oauth_success',provider:'microsoft'}, '*'); window.close()</script><h1>Connected successfully! You can close this window.</h1></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    return new Response(`<html><body><script>window.close()</script><h1>Error: ${error.message}</h1></body></html>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// ============================================
// PIXEL HANDLERS
// ============================================

async function handlePixel(request, env, path) {
  // Pixel JavaScript
  if (path.match(/^\/p\/[^/]+\.js$/)) {
    const siteId = path.split('/')[2].replace('.js', '');
    return await servePixelJS(siteId, env);
  }

  // Pixel GIF
  if (path.match(/^\/p\/[^/]+\.gif$/)) {
    const siteId = path.split('/')[2].replace('.gif', '');
    return await servePixelGIF(siteId, env);
  }

  return errorResponse('Not Found', 404);
}

async function servePixelJS(siteId, env) {
  try {
    const site = await env.DB.prepare(
      'SELECT * FROM sites WHERE id = ?'
    ).bind(siteId).first();

    if (!site) {
      return new Response('// Site not found', { headers: { 'Content-Type': 'application/javascript' } });
    }

    const pixelCode = `
(function() {
  // Respect Do Not Track
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  // Get or create anonymous ID
  var anonId = localStorage.getItem('nx_anon');
  if (!anonId) {
    anonId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('nx_anon', anonId);
  }

  // Collect data
  var data = {
    siteId: '${siteId}',
    url: window.location.href,
    referrer: document.referrer || '',
    anonId: anonId,
    ts: Math.floor(Date.now() / 1000),
    ua: navigator.userAgent
  };

  // Create HMAC signature
  var sigData = data.siteId + '|' + data.anonId + '|' + data.url + '|' + data.ts;
  
  // Send data
  fetch('${env.APP_ORIGIN}/api/pixel/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    keepalive: true
  }).catch(function() {});

  // Fallback pixel
  var img = new Image();
  img.src = '${env.APP_ORIGIN}/p/${siteId}.gif?anon=' + encodeURIComponent(anonId) + '&ts=' + data.ts;
})();
`;

    return new Response(pixelCode, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Serve pixel JS error:', error);
    return new Response('// Error loading pixel', { headers: { 'Content-Type': 'application/javascript' } });
  }
}

async function servePixelGIF(siteId, env) {
  // 1x1 transparent GIF
  const gif = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
  
  // Log pageview from URL params if provided
  try {
    const url = new URL(request.url);
    const anonId = url.searchParams.get('anon');
    const ts = url.searchParams.get('ts');
    
    if (anonId && ts) {
      // Quick async logging (don't wait)
      env.DB.prepare(
        'INSERT INTO pixel_events (id, site_id, ts, event_type, url, anon_id, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        generateId(),
        siteId,
        parseInt(ts),
        'pageview',
        url.searchParams.get('url') || 'unknown',
        anonId,
        'noscript',
        Math.floor(Date.now() / 1000)
      ).run().catch(e => console.error('Pixel GIF log error:', e));
    }
  } catch (e) {
    // Ignore errors
  }

  return new Response(gif, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function collectPixelEvent(request, env) {
  try {
    const body = await request.json();
    const { siteId, url, referrer, anonId, ts, ua } = body;

    if (!siteId || !url || !anonId || !ts) {
      return errorResponse('Missing required fields');
    }

    // Validate site
    const site = await env.DB.prepare(
      'SELECT * FROM sites WHERE id = ?'
    ).bind(siteId).first();

    if (!site) {
      return errorResponse('Site not found', 404);
    }

    // Validate allowed domains
    const urlObj = new URL(url);
    const allowedDomains = JSON.parse(site.allowed_domains_json || '[]');
    const isAllowed = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return errorResponse('Domain not allowed', 403);
    }

    // Validate timestamp (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
      return errorResponse('Timestamp out of range', 400);
    }

    // Rate limit per IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await checkRateLimit(`pixel:${clientIP}`, 100, 60, env)) {
      return errorResponse('Rate limit exceeded', 429);
    }

    // Hash IP
    const ipHash = await hashIP(clientIP, env.IP_HASH_SALT);

    // Get geo data from Cloudflare
    const country = request.headers.get('CF-IPCountry') || null;
    const city = request.headers.get('CF-IPCity') || null;

    // Store event
    const eventId = generateId();
    await env.DB.prepare(
      'INSERT INTO pixel_events (id, site_id, ts, event_type, url, referrer, anon_id, ip_hash, country, city, ua, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      eventId,
      siteId,
      ts,
      'pageview',
      url,
      referrer || null,
      anonId,
      ipHash,
      country,
      city,
      ua || null,
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({ ok: true });
  } catch (error) {
    console.error('Collect pixel event error:', error);
    return errorResponse('Failed to collect event', 500, error.message);
  }
}

// ============================================
// UNSUBSCRIBE HANDLER
// ============================================

async function handleUnsubscribe(request, env, url) {
  try {
    const orgId = url.searchParams.get('org');
    const email = url.searchParams.get('email');
    const sig = url.searchParams.get('sig');

    if (!orgId || !email || !sig) {
      return new Response('<html><body><h1>Invalid unsubscribe link</h1></body></html>', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Verify signature
    const expectedSig = await hmacSign(`${orgId}|${email}`, env.SESSION_SECRET);
    if (sig !== expectedSig) {
      return new Response('<html><body><h1>Invalid unsubscribe link</h1></body></html>', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Check if already unsubscribed
    const existing = await env.DB.prepare(
      'SELECT id FROM unsubscribes WHERE org_id = ? AND email = ?'
    ).bind(orgId, email).first();

    if (!existing) {
      // Add to unsubscribes
      await env.DB.prepare(
        'INSERT INTO unsubscribes (id, org_id, email, reason, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        generateId(),
        orgId,
        email,
        'User unsubscribed via link',
        Math.floor(Date.now() / 1000)
      ).run();

      // Mark any active enrollments as unsubscribed
      await env.DB.prepare(
        'UPDATE enrollments SET status = ? WHERE org_id = ? AND contact_id IN (SELECT id FROM contacts WHERE email = ?) AND status IN (?, ?)'
      ).bind('unsubscribed', orgId, email, 'active', 'pending').run();
    }

    return new Response(`
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          h1 { color: #333; }
          p { color: #666; line-height: 1.6; }
        </style>
      </head>
      <body>
        <h1>✓ Unsubscribed Successfully</h1>
        <p>You have been unsubscribed from all future emails.</p>
        <p>You will no longer receive emails from us at: <strong>${email}</strong></p>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response('<html><body><h1>Error processing unsubscribe</h1></body></html>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// ============================================
// TRACKING HANDLERS
// ============================================

async function handleTracking(request, env, path) {
  // Open tracking pixel
  if (path.match(/^\/t\/o\/[^/]+\.gif$/)) {
    const code = path.split('/')[3].replace('.gif', '');
    return await trackOpen(code, env, request);
  }

  // Click tracking redirect
  if (path.match(/^\/t\/c\/[^/]+$/)) {
    const code = path.split('/')[3];
    return await trackClick(code, env, request);
  }

  return errorResponse('Not Found', 404);
}

async function trackOpen(code, env, request) {
  try {
    // Find tracking link
    const link = await env.DB.prepare(
      'SELECT * FROM tracking_links WHERE code = ?'
    ).bind(code).first();

    if (link && link.message_id) {
      // Update message
      await env.DB.prepare(
        'UPDATE messages SET status = ?, opened_at = ? WHERE id = ? AND opened_at IS NULL'
      ).bind('opened', Math.floor(Date.now() / 1000), link.message_id).run();

      // Log tracking event
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipHash = await hashIP(clientIP, env.IP_HASH_SALT);

      await env.DB.prepare(
        'INSERT INTO tracking_events (id, org_id, type, message_id, ts, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        generateId(),
        link.org_id,
        'open',
        link.message_id,
        Math.floor(Date.now() / 1000),
        ipHash,
        request.headers.get('User-Agent') || null
      ).run();
    }
  } catch (error) {
    console.error('Track open error:', error);
  }

  // Return 1x1 transparent GIF
  const gif = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
  return new Response(gif, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

async function trackClick(code, env, request) {
  try {
    // Find tracking link
    const link = await env.DB.prepare(
      'SELECT * FROM tracking_links WHERE code = ?'
    ).bind(code).first();

    if (link) {
      // Update message
      if (link.message_id) {
        await env.DB.prepare(
          'UPDATE messages SET status = ?, clicked_at = ? WHERE id = ? AND clicked_at IS NULL'
        ).bind('clicked', Math.floor(Date.now() / 1000), link.message_id).run();

        // Log tracking event
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const ipHash = await hashIP(clientIP, env.IP_HASH_SALT);

        await env.DB.prepare(
          'INSERT INTO tracking_events (id, org_id, type, message_id, tracking_link_id, ts, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          generateId(),
          link.org_id,
          'click',
          link.message_id,
          link.id,
          Math.floor(Date.now() / 1000),
          ipHash,
          request.headers.get('User-Agent') || null
        ).run();
      }

      // Redirect to original URL
      return Response.redirect(link.url, 302);
    }
  } catch (error) {
    console.error('Track click error:', error);
  }

  return errorResponse('Link not found', 404);
}

// Continue with implementation files...
