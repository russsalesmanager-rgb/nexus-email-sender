// POST /api/auth/signup
import { handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import {
  generateId,
  hashPassword,
  generateToken,
  hashToken,
  addDays,
  now,
  isValidEmail,
  createSessionCookie,
  successResponse,
  errorResponse,
  logEvent,
} from '../../_shared/utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  try {
    const body = await request.json();
    const { email, password } = body;
    
    // Validate input
    if (!email || !password) {
      return addCORSHeaders(
        errorResponse('Invalid input', 'Email and password are required'),
        env
      );
    }
    
    if (!isValidEmail(email)) {
      return addCORSHeaders(
        errorResponse('Invalid email', 'Please provide a valid email address'),
        env
      );
    }
    
    if (password.length < 8) {
      return addCORSHeaders(
        errorResponse('Weak password', 'Password must be at least 8 characters'),
        env
      );
    }
    
    // Check if user already exists
    const existing = await env.DB
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first();
    
    if (existing) {
      return addCORSHeaders(
        errorResponse('Email exists', 'An account with this email already exists'),
        env
      );
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const userId = generateId();
    await env.DB
      .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(userId, email.toLowerCase(), passwordHash, now())
      .run();
    
    // Create session
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const sessionId = generateId();
    
    await env.DB
      .prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, userId, tokenHash, addDays(7), now())
      .run();
    
    // Log event
    await logEvent(env.DB, userId, 'user.signup', { email });
    
    // Create response with session cookie
    const response = successResponse({
      user: {
        id: userId,
        email: email.toLowerCase(),
      },
    });
    
    const headers = new Headers(response.headers);
    headers.set('Set-Cookie', createSessionCookie(token));
    
    return addCORSHeaders(
      new Response(response.body, {
        status: response.status,
        headers,
      }),
      env
    );
  } catch (error) {
    console.error('Signup error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
