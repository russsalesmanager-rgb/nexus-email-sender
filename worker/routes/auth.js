/**
 * Authentication routes
 * Handles signup, login, logout, and user info
 */

import { parseBody } from '../lib/router.js';
import { hashPassword, verifyPassword, generateToken, hashToken, generateUUID, isValidEmail, sanitizeInput } from '../lib/crypto.js';

/**
 * POST /api/auth/signup
 * Create a new organization and owner user
 */
export async function signup(request, env) {
  const body = await parseBody(request);
  const { email, password, org_name } = body;

  // Validation
  if (!email || !password || !org_name) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ ok: false, error: 'Password must be at least 8 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sanitizedEmail = sanitizeInput(email.toLowerCase());
  const sanitizedOrgName = sanitizeInput(org_name);

  try {
    // Check if email already exists
    const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(sanitizedEmail)
      .first();

    if (existingUser) {
      return new Response(JSON.stringify({ ok: false, error: 'Email already registered' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Hash password
    const { hash, salt } = await hashPassword(password);

    // Create org and user in a transaction
    const orgId = generateUUID();
    const userId = generateUUID();

    await env.DB.batch([
      env.DB.prepare('INSERT INTO orgs (id, name) VALUES (?, ?)')
        .bind(orgId, sanitizedOrgName),
      env.DB.prepare('INSERT INTO users (id, org_id, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, orgId, sanitizedEmail, hash, salt, 'OWNER'),
    ]);

    // Create session
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const sessionId = generateUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days

    await env.DB.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .bind(sessionId, userId, tokenHash, expiresAt)
      .run();

    // Log event
    await env.DB.prepare('INSERT INTO events (id, org_id, type, payload_json) VALUES (?, ?, ?, ?)')
      .bind(generateUUID(), orgId, 'user.signup', JSON.stringify({ user_id: userId, email: sanitizedEmail }))
      .run();

    const response = new Response(JSON.stringify({
      ok: true,
      data: {
        user_id: userId,
        org_id: orgId,
        email: sanitizedEmail,
        org_name: sanitizedOrgName,
        role: 'OWNER',
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

    // Set session cookie
    response.headers.append('Set-Cookie', `nxsess=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Signup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export async function login(request, env) {
  const body = await parseBody(request);
  const { email, password } = body;

  if (!email || !password) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing email or password' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sanitizedEmail = sanitizeInput(email.toLowerCase());

  try {
    // Get user
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(sanitizedEmail)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash, user.password_salt);

    if (!isValid) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get org name
    const org = await env.DB.prepare('SELECT name FROM orgs WHERE id = ?')
      .bind(user.org_id)
      .first();

    // Create session
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const sessionId = generateUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days

    await env.DB.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .bind(sessionId, user.id, tokenHash, expiresAt)
      .run();

    // Log event
    await env.DB.prepare('INSERT INTO events (id, org_id, type, payload_json) VALUES (?, ?, ?, ?)')
      .bind(generateUUID(), user.org_id, 'user.login', JSON.stringify({ user_id: user.id, email: sanitizedEmail }))
      .run();

    const response = new Response(JSON.stringify({
      ok: true,
      data: {
        user_id: user.id,
        org_id: user.org_id,
        email: user.email,
        org_name: org?.name,
        role: user.role,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    // Set session cookie
    response.headers.append('Set-Cookie', `nxsess=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Login failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/auth/logout
 * Destroy session
 */
export async function logout(request, env) {
  // Get session from cookie
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
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

  if (token) {
    try {
      const tokenHash = await hashToken(token);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(tokenHash)
        .run();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  // Clear cookie
  response.headers.append('Set-Cookie', 'nxsess=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

  return response;
}

/**
 * GET /api/me
 * Get current user info
 */
export async function me(request, env) {
  const user = request.user; // Set by auth middleware

  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get org name
  const org = await env.DB.prepare('SELECT name FROM orgs WHERE id = ?')
    .bind(user.org_id)
    .first();

  return new Response(JSON.stringify({
    ok: true,
    data: {
      user_id: user.id,
      org_id: user.org_id,
      email: user.email,
      org_name: org?.name,
      role: user.role,
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
