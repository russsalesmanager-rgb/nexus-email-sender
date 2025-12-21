// POST /api/auth/signup - Create new user account

import { jsonResponse, errorResponse } from '../../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../../lib/cors.js';
import { hashPassword, generateId } from '../../lib/auth.js';
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
        
        if (!password || password.length < 6) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Password must be at least 6 characters')),
                env.APP_ORIGIN
            );
        }
        
        // Check if user already exists
        const existing = await env.DB.prepare(
            'SELECT id FROM users WHERE email = ?'
        ).bind(email).first();
        
        if (existing) {
            return addCorsHeaders(
                addSecurityHeaders(errorResponse('Email already registered', 409)),
                env.APP_ORIGIN
            );
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create user
        const userId = generateId();
        await env.DB.prepare(
            'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
        ).bind(userId, email, passwordHash).run();
        
        // Log event
        await logEvent(env.DB, userId, 'user.signup', { email });
        
        // Return success (don't auto-login, require explicit login)
        return addCorsHeaders(
            addSecurityHeaders(jsonResponse({ message: 'Account created successfully', userId }, 201)),
            env.APP_ORIGIN
        );
        
    } catch (error) {
        console.error('Signup error:', error);
        return addCorsHeaders(
            addSecurityHeaders(errorResponse('Failed to create account', 500)),
            env.APP_ORIGIN
        );
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
