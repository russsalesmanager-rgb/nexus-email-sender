// Cloudflare Pages Functions - Main Entry Point
// This handles all routes: /api/*, /oauth/*, /p/*, /u/*, /t/*

import {
  generateId,
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  createSessionToken,
  hashToken,
  getCurrentUser,
  jsonResponse,
  errorResponse,
  successResponse,
  hashIP,
  hmacSign,
  hmacVerify,
  checkRateLimit,
  validateTurnstile
} from './utils.js';

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
    return await handleSignup(request, env);
  }
  if (path === '/api/auth/login' && method === 'POST') {
    return await handleLogin(request, env);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return await handleLogout(request, env);
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
    return await getContacts(user, env, request);
  }
  if (path === '/api/contacts' && method === 'POST') {
    return await createContact(user, env, request);
  }
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getContact(user, env, id);
  }
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    return await updateContact(user, env, id, request);
  }
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await deleteContact(user, env, id);
  }

  // Lists
  if (path === '/api/lists' && method === 'GET') {
    return await getLists(user, env);
  }
  if (path === '/api/lists' && method === 'POST') {
    return await createList(user, env, request);
  }
  if (path.match(/^\/api\/lists\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getList(user, env, id);
  }
  if (path.match(/^\/api\/lists\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await deleteList(user, env, id);
  }
  if (path.match(/^\/api\/lists\/[^/]+\/import$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await importContacts(user, env, id, request);
  }
  if (path.match(/^\/api\/lists\/[^/]+\/add-contacts$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await addContactsToList(user, env, id, request);
  }

  // Inboxes
  if (path === '/api/inboxes' && method === 'GET') {
    return await getInboxes(user, env);
  }
  if (path === '/api/inboxes/connect/google' && method === 'POST') {
    return await initiateGoogleOAuth(user, env);
  }
  if (path === '/api/inboxes/connect/microsoft' && method === 'POST') {
    return await initiateMicrosoftOAuth(user, env);
  }
  if (path.match(/^\/api\/inboxes\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    return await updateInbox(user, env, id, request);
  }
  if (path.match(/^\/api\/inboxes\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await deleteInbox(user, env, id);
  }

  // Sequences
  if (path === '/api/sequences' && method === 'GET') {
    return await getSequences(user, env);
  }
  if (path === '/api/sequences' && method === 'POST') {
    return await createSequence(user, env, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getSequence(user, env, id);
  }
  if (path.match(/^\/api\/sequences\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    return await updateSequence(user, env, id, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    return await deleteSequence(user, env, id);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/steps$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getSequenceSteps(user, env, id);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/steps$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await createSequenceStep(user, env, id, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/steps\/[^/]+$/) && method === 'DELETE') {
    const [, , , seqId, , stepId] = path.split('/');
    return await deleteSequenceStep(user, env, seqId, stepId);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/enroll$/) && method === 'POST') {
    const id = path.split('/')[3];
    return await enrollInSequence(user, env, id, request);
  }
  if (path.match(/^\/api\/sequences\/[^/]+\/status$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getSequenceStatus(user, env, id);
  }

  // Sending
  if (path === '/api/send/test' && method === 'POST') {
    return await sendTestEmail(user, env, request);
  }
  if (path === '/api/sending/start' && method === 'POST') {
    return await startSending(user, env);
  }
  if (path === '/api/sending/pause' && method === 'POST') {
    return await pauseSending(user, env);
  }
  if (path === '/api/sending/status' && method === 'GET') {
    return await getSendingStatus(user, env);
  }

  // Analytics
  if (path === '/api/analytics/overview' && method === 'GET') {
    return await getAnalyticsOverview(user, env, request);
  }
  if (path.match(/^\/api\/analytics\/sequence\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[4];
    return await getSequenceAnalytics(user, env, id);
  }
  if (path === '/api/events' && method === 'GET') {
    return await getEvents(user, env, request);
  }

  // Suppression
  if (path === '/api/suppression' && method === 'GET') {
    return await getSuppression(user, env);
  }
  if (path === '/api/suppression' && method === 'POST') {
    return await addSuppression(user, env, request);
  }

  // Pixel/Sites
  if (path === '/api/pixel/sites' && method === 'GET') {
    return await getSites(user, env);
  }
  if (path === '/api/pixel/sites' && method === 'POST') {
    return await createSite(user, env, request);
  }
  if (path.match(/^\/api\/pixel\/sites\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[4];
    return await getSite(user, env, id);
  }
  if (path.match(/^\/api\/pixel\/sites\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[4];
    return await deleteSite(user, env, id);
  }
  if (path.match(/^\/api\/pixel\/sites\/[^/]+\/stats$/) && method === 'GET') {
    const id = path.split('/')[4];
    return await getSiteStats(user, env, id, request);
  }
  if (path === '/api/pixel/collect' && method === 'POST') {
    return await collectPixelEvent(request, env);
  }

  return errorResponse('Not Found', 404);
}

// Continue with implementation files...
