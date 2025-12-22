/**
 * Nexus Email Sender - Cloudflare Worker
 * Main entry point for the API
 */

import { Router } from './lib/router.js';
import { authMiddleware } from './lib/auth-middleware.js';
import * as auth from './routes/auth.js';

// Create router
const router = new Router();

// Health check
router.get('/api/health', async () => {
  return new Response(JSON.stringify({ ok: true, status: 'healthy' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

// Auth routes (public)
router.post('/api/auth/signup', auth.signup);
router.post('/api/auth/login', auth.login);
router.post('/api/auth/logout', auth.logout);
router.get('/api/me', auth.me);

// TODO: Add more API routes here
// - /api/contacts
// - /api/lists
// - /api/inboxes
// - /api/sequences
// - /api/analytics
// - /api/pixel
// - /p/:siteId.js (pixel script)
// - /p/:siteId.gif (pixel image)

// Main export
export default {
  /**
   * Fetch handler
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Attach auth middleware to request
    // This adds user to request if authenticated
    const user = await authMiddleware(request, env);
    if (user) {
      request.user = user;
    }

    // Handle API routes
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/p/')) {
      return await router.handle(request, env, ctx);
    }

    // For all other routes, return 404 or pass through to Pages
    return new Response('Not Found', { status: 404 });
  },

  /**
   * Queue consumer (for send-jobs)
   */
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const job = message.body;
        console.log('Processing send job:', job);
        
        // TODO: Implement actual sending logic
        // This will be handled in Phase 5
        
        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      }
    }
  },
};

// Export Durable Object class
export { OrgScheduler } from './durable-objects/org-scheduler.js';
