/**
 * OrgScheduler Durable Object
 * Coordinates email sending for an organization
 * Ensures rate limits and proper distribution across inboxes
 */

export class OrgScheduler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Fetch handler for Durable Object
   */
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/schedule') {
      return await this.scheduleMessages(request);
    }

    if (url.pathname === '/status') {
      return await this.getStatus();
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Schedule messages for sending
   */
  async scheduleMessages(request) {
    try {
      const { org_id } = await request.json();

      // TODO: Implement scheduling logic in Phase 5
      // 1. Query enrollments that are ready to send (next_run_at <= now)
      // 2. Select appropriate inbox (check limits, rotation)
      // 3. Queue send job
      // 4. Update enrollment next_run_at

      return new Response(JSON.stringify({ ok: true, scheduled: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Schedule error:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Get scheduler status
   */
  async getStatus() {
    // TODO: Return scheduler state
    return new Response(JSON.stringify({ ok: true, status: 'idle' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Alarm handler - runs periodically to schedule sends
   */
  async alarm() {
    // TODO: Implement in Phase 5
    // This will be triggered every minute to schedule pending sends
    console.log('Alarm triggered for scheduler');
    
    // Schedule next alarm (1 minute)
    const now = Date.now();
    await this.state.storage.setAlarm(now + 60 * 1000);
  }
}
