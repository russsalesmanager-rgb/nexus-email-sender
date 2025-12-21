// POST /api/auth/login - Authenticate user and create session

import { jsonResponse, errorResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { verifyPassword, createSession, createSessionCookie } from '../../lib/auth.js';
import { isValidEmail, sanitize, logEvent } from '../../lib/db.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Handle CORS preflight
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;
    
    try {
        // Parse request body
        const body = await request.json();
        const email = sanitize(body.email)?.toLowerCase();
        const password = body.password;
        
        // Validate input
        if (!email || !isValidEmail(email)) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Valid email is required')),
                env.APP_ORIGIN
            );
        }
        
        if (!password) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Password is required')),
                env.APP_ORIGIN
            );
        }
        
        // Get user from database
        const user = await env.DB.prepare(
            'SELECT id, email, password_hash, created_at FROM users WHERE email = ?'
        ).bind(email).first();
        
        if (!user) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Invalid email or password', 401)),
                env.APP_ORIGIN
            );
        }
        
        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);
        
        if (!isValid) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Invalid email or password', 401)),
                env.APP_ORIGIN
            );
        }
        
        // Create session
        const { sessionId, token } = await createSession(env.DB, user.id);
        
        // Log event
        await logEvent(env.DB, user.id, 'user.login', { email });
        
        // Return user data with session cookie
        const response = jsonResponse({
            user: {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
            },
        });
        
        response.headers.set('Set-Cookie', createSessionCookie(token));
        
        return addCorsHeaders(addSecurityHeaders(response), env.APP_ORIGIN);
        
    } catch (error) {
        console.error('Login error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Login failed', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
