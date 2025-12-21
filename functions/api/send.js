/**
 * POST /api/send
 * Send a single test email
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail } from '../utils.js';
import { generateUUID } from '../crypto.js';
import { sendEmail } from '../mailchannels.js';

export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;
    
    try {
        const body = await parseBody(request);
        const { to_email, subject, html, text, sender_id, turnstileToken } = body;
        
        // TODO: Verify Turnstile token
        if (!turnstileToken) {
            return errorResponse('Turnstile token required', 400);
        }
        
        // Validate input
        if (!to_email || !isValidEmail(to_email)) {
            return errorResponse('Valid to_email is required', 400);
        }
        
        if (!subject || !subject.trim()) {
            return errorResponse('Subject is required', 400);
        }
        
        if (!html || !html.trim()) {
            return errorResponse('HTML content is required', 400);
        }
        
        // Get sender info
        let sender;
        
        if (sender_id) {
            sender = await env.DB
                .prepare('SELECT from_name, from_email, reply_to FROM senders WHERE id = ? AND user_id = ?')
                .bind(sender_id, user.id)
                .first();
            
            if (!sender) {
                return errorResponse('Invalid sender_id', 400);
            }
        } else {
            // Use default sender from environment or user's first sender
            const defaultSender = await env.DB
                .prepare('SELECT from_name, from_email, reply_to FROM senders WHERE user_id = ? LIMIT 1')
                .bind(user.id)
                .first();
            
            if (!defaultSender) {
                return errorResponse('No sender found. Please create a sender first.', 400);
            }
            
            sender = defaultSender;
        }
        
        // Send email
        await sendEmail({
            from_email: sender.from_email,
            from_name: sender.from_name,
            to_email: to_email,
            reply_to: sender.reply_to,
            subject: subject.trim(),
            html: html,
            text: text || null
        });
        
        // Log event
        await env.DB
            .prepare(`
                INSERT INTO events (id, user_id, type, payload_json)
                VALUES (?, ?, ?, ?)
            `)
            .bind(
                generateUUID(),
                user.id,
                'email.test_sent',
                JSON.stringify({
                    to_email,
                    subject
                })
            )
            .run();
        
        return jsonResponse({
            success: true,
            message: 'Email sent successfully'
        });
    } catch (error) {
        console.error('Send test email error:', error);
        return errorResponse(`Failed to send email: ${error.message}`, 500);
    }
}
