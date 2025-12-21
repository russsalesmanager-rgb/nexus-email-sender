// POST /api/campaigns/:id/send - Process and send next batch of campaign jobs
import { requireAuth, handleCORS, addCORSHeaders } from '../../../_shared/auth.js';
import {
  successResponse,
  errorResponse,
  logEvent,
  now,
  verifyTurnstile,
  checkRateLimit,
} from '../../../_shared/utils.js';
import { sendEmail, replaceVariables } from '../../../_shared/mailchannels.js';

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    // Verify Turnstile token - require it if Turnstile is configured
    const body = await request.json();
    const { turnstile_token } = body;
    
    if (env.TURNSTILE_SECRET) {
      if (!turnstile_token) {
        return addCORSHeaders(errorResponse('Turnstile required', 'Security token is required'), env);
      }
      
      const clientIP = request.headers.get('CF-Connecting-IP') || '';
      const isValid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET, clientIP);
      
      if (!isValid) {
        return addCORSHeaders(errorResponse('Turnstile failed', 'Security verification failed'), env);
      }
    }
    
    // Check rate limits
    if (env.KV) {
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipLimit = await checkRateLimit(env.KV, `send:ip:${clientIP}`, 30, 3600); // 30/hour
      
      if (!ipLimit.allowed) {
        return addCORSHeaders(errorResponse('rate_limited', 'IP rate limit exceeded'), env);
      }
      
      const userLimit = await checkRateLimit(env.KV, `send:user:${auth.user.id}`, 300, 86400); // 300/day
      
      if (!userLimit.allowed) {
        return addCORSHeaders(errorResponse('rate_limited', 'User rate limit exceeded'), env);
      }
    }
    
    // Get campaign
    const campaign = await env.DB
      .prepare('SELECT id, sender_id, template_id, status FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(params.id, auth.user.id)
      .first();
    
    if (!campaign) {
      return addCORSHeaders(errorResponse('Not found', 'Campaign not found', 404), env);
    }
    
    if (campaign.status !== 'queued' && campaign.status !== 'sending') {
      return addCORSHeaders(errorResponse('Invalid status', 'Campaign is not ready to send'), env);
    }
    
    // Get sender and template
    const sender = await env.DB
      .prepare('SELECT from_name, from_email, reply_to FROM senders WHERE id = ?')
      .bind(campaign.sender_id)
      .first();
    
    const template = await env.DB
      .prepare('SELECT subject, html, text FROM templates WHERE id = ?')
      .bind(campaign.template_id)
      .first();
    
    // Get next batch of queued jobs (25-50)
    const batchSize = 50;
    const { results: jobs } = await env.DB
      .prepare(`
        SELECT cj.id, cj.contact_id, c.email, c.first_name, c.last_name
        FROM campaign_jobs cj
        JOIN contacts c ON cj.contact_id = c.id
        WHERE cj.campaign_id = ? AND cj.status = 'queued'
        LIMIT ?
      `)
      .bind(params.id, batchSize)
      .all();
    
    if (jobs.length === 0) {
      // All jobs processed, mark campaign as completed
      await env.DB
        .prepare('UPDATE campaigns SET status = ? WHERE id = ?')
        .bind('completed', params.id)
        .run();
      
      return addCORSHeaders(successResponse({
        message: 'Campaign completed',
        sent: 0,
        failed: 0,
      }), env);
    }
    
    // Update campaign status to sending
    if (campaign.status === 'queued') {
      await env.DB
        .prepare('UPDATE campaigns SET status = ? WHERE id = ?')
        .bind('sending', params.id)
        .run();
    }
    
    let sent = 0;
    let failed = 0;
    
    // Process each job
    for (const job of jobs) {
      try {
        // Replace template variables
        const variables = {
          first_name: job.first_name || '',
          last_name: job.last_name || '',
          email: job.email,
        };
        
        const subject = replaceVariables(template.subject, variables);
        const htmlBody = template.html ? replaceVariables(template.html, variables) : null;
        const textBody = template.text ? replaceVariables(template.text, variables) : null;
        
        // Send email
        const result = await sendEmail({
          fromEmail: sender.from_email,
          fromName: sender.from_name,
          replyTo: sender.reply_to,
          toEmail: job.email,
          toName: job.first_name ? `${job.first_name} ${job.last_name || ''}`.trim() : null,
          subject,
          htmlBody,
          textBody,
        });
        
        if (result.success) {
          // Mark job as sent
          await env.DB
            .prepare('UPDATE campaign_jobs SET status = ?, provider_message_id = ?, sent_at = ? WHERE id = ?')
            .bind('sent', result.messageId, now(), job.id)
            .run();
          sent++;
        } else {
          // Mark job as failed
          await env.DB
            .prepare('UPDATE campaign_jobs SET status = ?, last_error = ? WHERE id = ?')
            .bind('failed', result.error, job.id)
            .run();
          failed++;
        }
      } catch (error) {
        console.error('Send job error:', error);
        await env.DB
          .prepare('UPDATE campaign_jobs SET status = ?, last_error = ? WHERE id = ?')
          .bind('failed', error.message, job.id)
          .run();
        failed++;
      }
    }
    
    await logEvent(env.DB, auth.user.id, 'campaign.send_batch', {
      campaign_id: params.id,
      sent,
      failed,
    });
    
    return addCORSHeaders(successResponse({
      message: 'Batch processed',
      sent,
      failed,
    }), env);
  } catch (error) {
    console.error('Send campaign error:', error);
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
