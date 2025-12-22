// Authentication handlers

import {
  generateId,
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashToken,
  errorResponse,
  successResponse,
  checkRateLimit
} from '../utils.js';

export async function handleSignup(request, env) {
  try {
    const body = await request.json();
    const { email, password, orgName } = body;

    if (!email || !password || !orgName) {
      return errorResponse('Email, password, and organization name are required');
    }

    // Rate limit
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await checkRateLimit(`signup:${clientIP}`, 5, 3600, env)) {
      return errorResponse('Too many signup attempts. Please try again later.', 429);
    }

    // Check if user exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return errorResponse('Email already registered');
    }

    // Create org
    const orgId = generateId();
    await env.DB.prepare(
      'INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)'
    ).bind(orgId, orgName, Math.floor(Date.now() / 1000)).run();

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    await env.DB.prepare(
      'INSERT INTO users (id, org_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, orgId, email, passwordHash, 'OWNER', Math.floor(Date.now() / 1000)).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      orgId,
      userId,
      'auth.signup',
      JSON.stringify({ email }),
      Math.floor(Date.now() / 1000)
    ).run();

    return successResponse({
      message: 'Account created successfully. Please login.'
    });
  } catch (error) {
    console.error('Signup error:', error);
    return errorResponse('Signup failed', 500, error.message);
  }
}

export async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    // Rate limit
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await checkRateLimit(`login:${clientIP}`, 10, 600, env)) {
      return errorResponse('Too many login attempts. Please try again later.', 429);
    }

    // Find user
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse('Invalid credentials', 401);
    }

    // Create session
    const sessionId = generateId();
    const sessionToken = await createSessionToken(user.id, env);
    const tokenHash = await hashToken(sessionToken);
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sessionId, user.id, tokenHash, expiresAt, Math.floor(Date.now() / 1000)).run();

    // Log event
    await env.DB.prepare(
      'INSERT INTO events (id, org_id, user_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      generateId(),
      user.org_id,
      user.id,
      'auth.login',
      JSON.stringify({ email }),
      Math.floor(Date.now() / 1000)
    ).run();

    // Return session cookie
    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
        org_id: user.org_id,
        role: user.role
      }
    });

    response.headers.set('Set-Cookie', `nxsess=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Login failed', 500, error.message);
  }
}

export async function handleLogout(request, env) {
  try {
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(/nxsess=([^;]+)/);

    if (match) {
      const sessionToken = match[1];
      const tokenHash = await hashToken(sessionToken);

      // Delete session
      await env.DB.prepare(
        'DELETE FROM sessions WHERE token_hash = ?'
      ).bind(tokenHash).run();
    }

    const response = successResponse({ message: 'Logged out successfully' });
    response.headers.set('Set-Cookie', 'nxsess=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Logout failed', 500, error.message);
  }
}
