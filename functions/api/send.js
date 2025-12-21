// POST /api/send - Send a test email
import { requireAuth, handleCORS, addCORSHeaders } from '../_shared/auth.js';
import {
  isValidEmail,
  successResponse,
  errorResponse,
  logEvent,
  verifyTurnstile,
  checkRateLimit,
} from '../_shared/utils.js';
import { sendEmail } from '../_shared/mailchannels.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  try {
    const body = await request.json();
    const { to_email, from_email, from_name, reply_to, subject, html, text, turnstile_token } = body;
    
    // Validate input
    if (!to_email || !from_email || !subject) {
      return addCORSHeaders(
        errorResponse('Invalid input', 'to_email, from_email, and subject are required'),
        env
      );
    }
    
    if (!isValidEmail(to_email) || !isValidEmail(from_email)) {
      return addCORSHeaders(
        errorResponse('Invalid email', 'Please provide valid email addresses'),
        env
      );
    }
    
    if (!html && !text) {
      return addCORSHeaders(
        errorResponse('Invalid content', 'Either html or text content is required'),
        env
      );
    }
    
    // Verify Turnstile token - require it if Turnstile is configured
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
    
    // Send email
    const result = await sendEmail({
      fromEmail: from_email,
      fromName: from_name || null,
      replyTo: reply_to || null,
      toEmail: to_email,
      toName: null,
      subject,
      htmlBody: html || null,
      textBody: text || null,
    });
    
    if (result.success) {
      await logEvent(env.DB, auth.user.id, 'email.sent', {
        to: to_email,
        from: from_email,
        subject,
      });
      
      return addCORSHeaders(successResponse({
        message: 'Email sent successfully',
        message_id: result.messageId,
      }), env);
    } else {
      return addCORSHeaders(
        errorResponse('Send failed', result.error, 500),
        env
      );
    }
  } catch (error) {
    console.error('Send email error:', error);
    return addCORSHeaders(errorResponse('Server error', error.message, 500), env);
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
