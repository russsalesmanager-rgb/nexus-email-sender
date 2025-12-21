// Cloudflare Pages Functions - Main Router
// This file handles all API routes, OAuth callbacks, and pixel endpoints

// Utility: Generate UUID
export function generateId() {
  return crypto.randomUUID();
}

// Utility: Hash password using PBKDF2
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Combine salt and hash
  const combined = new Uint8Array(salt.length + derivedBits.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(derivedBits), salt.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

// Utility: Verify password
export async function verifyPassword(password, hash) {
  try {
    const combined = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const derivedArray = new Uint8Array(derivedBits);
    
    // Compare
    if (derivedArray.length !== storedHash.length) return false;
    let result = 0;
    for (let i = 0; i < derivedArray.length; i++) {
      result |= derivedArray[i] ^ storedHash[i];
    }
    return result === 0;
  } catch (e) {
    console.error('Password verification error:', e);
    return false;
  }
}

// Utility: Encrypt OAuth tokens using AES-GCM
export async function encryptData(data, keyBase64) {
  const key = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(JSON.stringify(data))
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Utility: Decrypt OAuth tokens
export async function decryptData(encryptedBase64, keyBase64) {
  try {
    const key = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (e) {
    console.error('Decryption error:', e);
    return null;
  }
}

// Utility: Create session token
export async function createSessionToken(userId, env) {
  const tokenData = `${userId}:${Date.now()}:${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(tokenData + ':' + env.SESSION_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}

// Utility: Hash token for storage
export async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}

// Utility: Get current user from session
export async function getCurrentUser(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/nxsess=([^;]+)/);
  
  if (!match) return null;
  
  const sessionToken = match[1];
  const tokenHash = await hashToken(sessionToken);
  
  const session = await env.DB.prepare(
    'SELECT s.*, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first();
  
  if (!session) return null;
  
  return {
    id: session.user_id,
    email: session.email,
    org_id: session.org_id,
    role: session.role
  };
}

// Utility: JSON response helper
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// Utility: Error response helper
export function errorResponse(message, status = 400, detail = null) {
  return jsonResponse({ ok: false, error: message, detail }, status);
}

// Utility: Success response helper
export function successResponse(data) {
  return jsonResponse({ ok: true, data });
}

// Utility: Hash IP for privacy
export async function hashIP(ip, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray)).substring(0, 16);
}

// Utility: HMAC signing
export async function hmacSign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Utility: HMAC verify
export async function hmacVerify(data, signature, secret) {
  const expectedSignature = await hmacSign(data, secret);
  return expectedSignature === signature;
}

// Utility: Rate limit check using KV
export async function checkRateLimit(key, limit, windowSeconds, env) {
  const now = Math.floor(Date.now() / 1000);
  const kvKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
  
  const count = parseInt(await env.KV_CACHE.get(kvKey) || '0');
  
  if (count >= limit) {
    return false;
  }
  
  await env.KV_CACHE.put(kvKey, String(count + 1), {
    expirationTtl: windowSeconds * 2
  });
  
  return true;
}

// Utility: Validate Turnstile token
export async function validateTurnstile(token, env) {
  if (!token) return false;
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token
      })
    });
    
    const result = await response.json();
    return result.success === true;
  } catch (e) {
    console.error('Turnstile validation error:', e);
    return false;
  }
}

export { SendCoordinator } from './durable-objects/SendCoordinator.js';
