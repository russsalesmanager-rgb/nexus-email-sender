// Shared utility functions for Cloudflare Workers/Pages Functions
// Compatible with Workers runtime (no Node.js APIs)

/**
 * Generate a random ID
 */
export function generateId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password using PBKDF2
 * Format: pbkdf2$iterations$saltBase64$hashBase64
 */
export async function hashPassword(password) {
  const iterations = 100000;
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  
  return `pbkdf2$${iterations}$${saltBase64}$${hashBase64}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
  const parts = hash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }
  
  const iterations = parseInt(parts[1]);
  const salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
  const storedHash = parts[3];
  
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  const computedHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return computedHash === storedHash;
}

/**
 * Generate a secure random token
 */
export function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a token using SHA-256
 */
export async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), byte => 
    byte.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Get user from session token
 */
export async function getUserFromToken(db, token) {
  if (!token) return null;
  
  const tokenHash = await hashToken(token);
  
  const session = await db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first();
  
  if (!session) return null;
  
  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    return null;
  }
  
  const user = await db
    .prepare('SELECT id, email, created_at FROM users WHERE id = ?')
    .bind(session.user_id)
    .first();
  
  return user;
}

/**
 * Standard JSON response
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

/**
 * Success response
 */
export function successResponse(data) {
  return jsonResponse({ ok: true, data });
}

/**
 * Error response
 */
export function errorResponse(error, detail = null, status = 400) {
  return jsonResponse(
    { ok: false, error, ...(detail && { detail }) },
    status
  );
}

/**
 * Parse cookies from request
 */
export function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return {};
  
  return Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [key, ...value] = cookie.trim().split('=');
      return [key, value.join('=')];
    })
  );
}

/**
 * Create a session cookie
 */
export function createSessionCookie(token, maxAge = 7 * 24 * 60 * 60) {
  return `nxsess=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/**
 * Create a cookie deletion header
 */
export function deleteSessionCookie() {
  return 'nxsess=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Get current ISO timestamp
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Add days to current date
 */
export function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstile(token, secret, ip) {
  if (!secret || !token) return false;
  
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

/**
 * Check rate limit using KV
 */
export async function checkRateLimit(kv, key, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
  
  const current = await kv.get(windowKey);
  const count = current ? parseInt(current) : 0;
  
  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  await kv.put(windowKey, (count + 1).toString(), { expirationTtl: windowSeconds * 2 });
  
  return { allowed: true, remaining: limit - count - 1 };
}

/**
 * Log an event to the database
 */
export async function logEvent(db, userId, type, payload = {}) {
  await db
    .prepare('INSERT INTO events (id, user_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(generateId(), userId, type, JSON.stringify(payload), now())
    .run();
}
