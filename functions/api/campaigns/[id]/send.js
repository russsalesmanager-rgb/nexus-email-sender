/**
 * POST /api/campaigns/:id/send
 * Process next batch of queued campaign jobs and send emails
 */

import { jsonResponse, errorResponse, parseBody, now } from '../../../utils.js';
import { generateUUID } from '../../../crypto.js';
import { sendEmail, replaceVariables } from '../../../mailchannels.js';

const BATCH_SIZE = 25; // Number of emails to send per batch

export async function onRequestPost(context) {
    const { request, env, params, data } = context;
    const user = data.user;
    const campaignId = params.id;
    
    try {
        const body = await parseBody(request);
        const { turnstileToken } = body;
        
        // TODO: Verify Turnstile token
        // For now, we'll skip this in development
        if (!turnstileToken) {
            return errorResponse('Turnstile token required', 400);
        }
        
        // Get campaign with all needed data
        const campaign = await env.DB
            .prepare(`
                SELECT c.id, c.name, c.sender_id, c.template_id, c.list_id, c.status,
                       s.from_name, s.from_email, s.reply_to,
                       t.subject, t.html, t.text
                FROM campaigns c
                LEFT JOIN senders s ON c.sender_id = s.id
                LEFT JOIN templates t ON c.template_id = t.id
                WHERE c.id = ? AND c.user_id = ?
            `)
            .bind(campaignId, user.id)
            .first();
        
        if (!campaign) {
            return errorResponse('Campaign not found', 404);
        }
        
        if (!campaign.sender_id || !campaign.template_id) {
            return errorResponse('Campaign must have sender and template', 400);
        }
        
        // Get next batch of queued jobs
        const { results: jobs } = await env.DB
            .prepare(`
                SELECT cj.id, cj.contact_id, c.email, c.first_name, c.last_name
                FROM campaign_jobs cj
                JOIN contacts c ON cj.contact_id = c.id
                WHERE cj.campaign_id = ? AND cj.status = 'queued'
                LIMIT ?
            `)
            .bind(campaignId, BATCH_SIZE)
            .all();
        
        if (jobs.length === 0) {
            return jsonResponse({
                success: true,
                sent: 0,
                message: 'No queued emails to send'
            });
        }
        
        // Send emails
        let sent = 0;
        let failed = 0;
        const sentAt = now();
        
        for (const job of jobs) {
            try {
                // Prepare template variables
                const variables = {
                    first_name: job.first_name || '',
                    last_name: job.last_name || '',
                    email: job.email,
                    name: `${job.first_name || ''} ${job.last_name || ''}`.trim()
                };
                
                // Replace variables in content
                const subject = replaceVariables(campaign.subject, variables);
                const html = replaceVariables(campaign.html, variables);
                const text = campaign.text ? replaceVariables(campaign.text, variables) : null;
                
                // Send email
                await sendEmail({
                    from_email: campaign.from_email,
                    from_name: campaign.from_name,
                    to_email: job.email,
                    to_name: variables.name,
                    reply_to: campaign.reply_to,
                    subject,
                    html,
                    text
                });
                
                // Mark job as sent
                await env.DB
                    .prepare(`
                        UPDATE campaign_jobs
                        SET status = 'sent', sent_at = ?
                        WHERE id = ?
                    `)
                    .bind(sentAt, job.id)
                    .run();
                
                sent++;
                
                // Log event
                await env.DB
                    .prepare(`
                        INSERT INTO events (id, user_id, type, payload_json)
                        VALUES (?, ?, ?, ?)
                    `)
                    .bind(
                        generateUUID(),
                        user.id,
                        'email.sent',
                        JSON.stringify({
                            campaignId,
                            jobId: job.id,
                            contactId: job.contact_id,
                            email: job.email
                        })
                    )
                    .run();
                
            } catch (error) {
                console.error(`Failed to send email to ${job.email}:`, error);
                
                // Mark job as failed
                await env.DB
                    .prepare(`
                        UPDATE campaign_jobs
                        SET status = 'failed', last_error = ?
                        WHERE id = ?
                    `)
                    .bind(error.message, job.id)
                    .run();
                
                failed++;
            }
        }
        
        // Update campaign status
        const remainingJobs = await env.DB
            .prepare(`
                SELECT COUNT(*) as count
                FROM campaign_jobs
                WHERE campaign_id = ? AND status = 'queued'
            `)
            .bind(campaignId)
            .first();
        
        if (remainingJobs.count === 0) {
            // All jobs processed, mark campaign as completed
            await env.DB
                .prepare('UPDATE campaigns SET status = ? WHERE id = ?')
                .bind('completed', campaignId)
                .run();
        }
        
        return jsonResponse({
            success: true,
            sent,
            failed,
            remaining: remainingJobs.count
        });
    } catch (error) {
        console.error('Send campaign batch error:', error);
        return errorResponse('Internal server error', 500);
    }
}
