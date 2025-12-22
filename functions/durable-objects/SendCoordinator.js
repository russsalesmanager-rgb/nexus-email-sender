// SendCoordinator Durable Object
// Ensures only one scheduler loop runs per organization

export class SendCoordinator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.isRunning = false;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/start') {
      return await this.startScheduler(request);
    }

    if (path === '/stop') {
      return await this.stopScheduler();
    }

    if (path === '/status') {
      return new Response(JSON.stringify({ running: this.isRunning }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  async startScheduler(request) {
    if (this.isRunning) {
      return new Response(JSON.stringify({ ok: true, message: 'Already running' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    this.isRunning = true;

    // Start the scheduler loop
    this.schedulerLoop().catch(error => {
      console.error('Scheduler loop error:', error);
      this.isRunning = false;
    });

    return new Response(JSON.stringify({ ok: true, message: 'Scheduler started' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async stopScheduler() {
    this.isRunning = false;
    return new Response(JSON.stringify({ ok: true, message: 'Scheduler stopped' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async schedulerLoop() {
    while (this.isRunning) {
      try {
        await this.processDueEnrollments();
      } catch (error) {
        console.error('Process enrollments error:', error);
      }

      // Wait before next iteration (e.g., 60 seconds)
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }

  async processDueEnrollments() {
    // Get org_id from state (set during initialization)
    const orgId = await this.state.storage.get('org_id');
    if (!orgId) return;

    const now = Math.floor(Date.now() / 1000);

    // Get due enrollments (limit to batch size)
    const enrollments = await this.env.DB.prepare(
      `SELECT e.*, c.email, c.first_name, c.last_name
      FROM enrollments e
      JOIN contacts c ON e.contact_id = c.id
      WHERE e.org_id = ? AND e.status = 'active' AND e.next_run_at <= ?
      LIMIT 100`
    ).bind(orgId, now).all();

    if (enrollments.results.length === 0) return;

    console.log(`Processing ${enrollments.results.length} due enrollments for org ${orgId}`);

    for (const enrollment of enrollments.results) {
      try {
        // Check suppression
        const suppressed = await this.env.DB.prepare(
          'SELECT id FROM suppression WHERE org_id = ? AND email = ?'
        ).bind(orgId, enrollment.email).first();

        if (suppressed) {
          await this.env.DB.prepare(
            'UPDATE enrollments SET status = ? WHERE id = ?'
          ).bind('bounced', enrollment.id).run();
          continue;
        }

        // Check unsubscribes
        const unsubscribed = await this.env.DB.prepare(
          'SELECT id FROM unsubscribes WHERE org_id = ? AND email = ?'
        ).bind(orgId, enrollment.email).first();

        if (unsubscribed) {
          await this.env.DB.prepare(
            'UPDATE enrollments SET status = ? WHERE id = ?'
          ).bind('unsubscribed', enrollment.id).run();
          continue;
        }

        // Get sequence step
        const step = await this.env.DB.prepare(
          'SELECT * FROM sequence_steps WHERE sequence_id = ? AND step_index = ?'
        ).bind(enrollment.sequence_id, enrollment.current_step).first();

        if (!step) {
          // No more steps, mark as completed
          await this.env.DB.prepare(
            'UPDATE enrollments SET status = ?, completed_at = ? WHERE id = ?'
          ).bind('completed', now, enrollment.id).run();
          continue;
        }

        // Select eligible inbox (simple round-robin for now)
        const inbox = await this.env.DB.prepare(
          'SELECT * FROM inboxes WHERE org_id = ? AND status = ? ORDER BY id LIMIT 1'
        ).bind(orgId, 'active').first();

        if (!inbox) {
          console.log('No active inboxes available');
          continue;
        }

        // Enqueue send job
        await this.env.SEND_QUEUE.send({
          enrollment_id: enrollment.id,
          step_id: step.id,
          inbox_id: inbox.id,
          to_email: enrollment.email,
          to_name: `${enrollment.first_name || ''} ${enrollment.last_name || ''}`.trim(),
          subject: step.subject,
          html: step.html,
          text: step.text
        });

        // Update enrollment for next step
        const nextStepIndex = enrollment.current_step + 1;
        const nextRunAt = now + (step.wait_days * 24 * 60 * 60);

        await this.env.DB.prepare(
          'UPDATE enrollments SET current_step = ?, next_run_at = ? WHERE id = ?'
        ).bind(nextStepIndex, nextRunAt, enrollment.id).run();

        console.log(`Enqueued send job for enrollment ${enrollment.id}`);
      } catch (error) {
        console.error(`Error processing enrollment ${enrollment.id}:`, error);
      }
    }
  }
}
