/**
 * POST /api/auth/signup
 * Create a new user account
 */

import { jsonResponse, errorResponse, parseBody, isValidEmail, createCookie } from '../../utils.js';
import { hashPassword, generateUUID } from '../../crypto.js';
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
        
        if (password.length < 8) {
            return errorResponse('Password must be at least 8 characters', 400);
        }
        
        // Check if user already exists
        const existing = await env.DB
            .prepare('SELECT id FROM users WHERE email = ?')
            .bind(email.toLowerCase())
            .first();
        
        if (existing) {
            return errorResponse('Email already registered', 409);
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create user
        const userId = generateUUID();
        await env.DB
            .prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
            .bind(userId, email.toLowerCase(), passwordHash)
            .run();
        
        // Create session
        const { token } = await createSession(env.DB, userId);
        
        // Create response with session cookie
        const response = jsonResponse({
            success: true,
            user: {
                id: userId,
                email: email.toLowerCase()
            }
        }, 201);
        
        response.headers.set('Set-Cookie', createCookie('nxsess', token));
        
        return response;
    } catch (error) {
        console.error('Signup error:', error);
        return errorResponse('Internal server error', 500);
    }
}
