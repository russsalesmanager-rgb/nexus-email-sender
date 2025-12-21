// Authentication utilities for session management and password hashing

// Generate a random ID
export function generateId() {
    return crypto.randomUUID();
}

// Hash a password using PBKDF2
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    const key = await crypto.subtle.importKey(
        'raw',
        data,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        key,
        256
    );
    
    const hashArray = Array.from(new Uint8Array(bits));
    const saltArray = Array.from(salt);
    
    return JSON.stringify({ hash: hashArray, salt: saltArray });
}

// Verify a password against a hash
export async function verifyPassword(password, storedHash) {
    try {
        const { hash: storedHashArray, salt: storedSaltArray } = JSON.parse(storedHash);
        
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const salt = new Uint8Array(storedSaltArray);
        
        const key = await crypto.subtle.importKey(
            'raw',
            data,
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const bits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            key,
            256
        );
        
        const hashArray = Array.from(new Uint8Array(bits));
        
        // Compare arrays
        if (hashArray.length !== storedHashArray.length) return false;
        for (let i = 0; i < hashArray.length; i++) {
            if (hashArray[i] !== storedHashArray[i]) return false;
        }
        
        return true;
    } catch (error) {
        console.error('Password verification error:', error);
        return false;
    }
}

// Generate a session token
export function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash a session token for storage
export async function hashSessionToken(token) {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Create a session
export async function createSession(db, userId) {
    const sessionId = generateId();
    const token = generateSessionToken();
    const tokenHash = await hashSessionToken(token);
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
    
    await db.prepare(
        'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(sessionId, userId, tokenHash, expiresAt).run();
    
    return { sessionId, token };
}

// Get user from session token
export async function getUserFromSession(db, token) {
    if (!token) return null;
    
    try {
        const tokenHash = await hashSessionToken(token);
        const now = Math.floor(Date.now() / 1000);
        
        const result = await db.prepare(`
            SELECT u.id, u.email, u.created_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).bind(tokenHash, now).first();
        
        return result || null;
    } catch (error) {
        console.error('Session lookup error:', error);
        return null;
    }
}

// Delete a session
export async function deleteSession(db, token) {
    if (!token) return;
    
    try {
        const tokenHash = await hashSessionToken(token);
        await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    } catch (error) {
        console.error('Session deletion error:', error);
    }
}

// Get session token from cookie
export function getSessionToken(request) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});
    
    return cookies['nxsess'] || null;
}

// Create session cookie header
export function createSessionCookie(token, maxAge = 7 * 24 * 60 * 60) {
    return `nxsess=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

// Create delete session cookie header
export function deleteSessionCookie() {
    return 'nxsess=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

// Middleware to require authentication
export async function requireAuth(request, env) {
    const token = getSessionToken(request);
    const user = await getUserFromSession(env.DB, token);
    
    if (!user) {
        return { authorized: false, user: null };
    }
    
    return { authorized: true, user };
}
