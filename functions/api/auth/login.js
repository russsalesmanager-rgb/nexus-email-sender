/**
 * POST /api/auth/login
 * Authenticate user and create session
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail, createCookie } from '../../utils.js';
import { verifyPassword } from '../../crypto.js';
import { createSession } from '../../session.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const body = await parseBody(request);
        const { email, password } = body;
        
        // Validate input
        if (!email || !password) {
            return errorResponse('Email and password are required', 400);
        }
        
        if (!isValidEmail(email)) {
            return errorResponse('Invalid email format', 400);
        }
        
        // Find user
        const user = await env.DB
            .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
            .bind(email.toLowerCase())
            .first();
        
        if (!user) {
            return errorResponse('Invalid credentials', 401);
        }
        
        // Verify password
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return errorResponse('Invalid credentials', 401);
        }
        
        // Create session
        const { token } = await createSession(env.DB, user.id);
        
        // Create response with session cookie
        const response = jsonResponse({
            success: true,
            user: {
                id: user.id,
                email: user.email
            }
        });
        
        response.headers.set('Set-Cookie', createCookie('nxsess', token));
        
        return response;
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('Internal server error', 500);
    }
}
