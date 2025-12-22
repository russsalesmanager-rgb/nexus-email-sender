/**
 * Authentication middleware
 * Verifies session and attaches user to request
 */

import { hashToken } from './crypto.js';

/**
 * Auth middleware - verifies session token
 */
export async function authMiddleware(request, env) {
  // Get token from cookie
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  let token = null;
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'nxsess') {
      token = value;
      break;
    }
  }

  if (!token) {
    return null;
  }

  try {
    const tokenHash = await hashToken(token);
    const now = Math.floor(Date.now() / 1000);

    // Get session
    const session = await env.DB.prepare(
      'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'
    )
      .bind(tokenHash, now)
      .first();

    if (!session) {
      return null;
    }

    // Get user
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(session.user_id)
      .first();

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Auth middleware error:', error);
    return null;
  }
}

/**
 * Require auth - returns 401 if not authenticated
 */
export async function requireAuth(request, env) {
  const user = await authMiddleware(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Attach user to request for use in handlers
  request.user = user;
  
  return null; // No error, proceed
}

/**
 * Require specific role
 */
export function requireRole(allowedRoles) {
  return async function(request, env) {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    const user = request.user;
    
    if (!allowedRoles.includes(user.role)) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return null; // No error, proceed
  };
}
