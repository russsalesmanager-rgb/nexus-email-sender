// POST /api/auth/login
import { handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import {
  generateId,
  verifyPassword,
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
    
    // Find user
    const user = await env.DB
      .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first();
    
    if (!user) {
      return addCORSHeaders(
        errorResponse('Invalid credentials', 'Email or password is incorrect'),
        env
      );
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return addCORSHeaders(
        errorResponse('Invalid credentials', 'Email or password is incorrect'),
        env
      );
    }
    
    // Create session
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const sessionId = generateId();
    
    await env.DB
      .prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, user.id, tokenHash, addDays(7), now())
      .run();
    
    // Log event
    await logEvent(env.DB, user.id, 'user.login', { email: user.email });
    
    // Create response with session cookie
    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
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
    console.error('Login error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
