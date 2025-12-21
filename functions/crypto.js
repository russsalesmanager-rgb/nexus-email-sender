/**
 * Cryptography utilities for Cloudflare Workers
 * PBKDF2 password hashing using WebCrypto API
 */

/**
 * Hash a password using PBKDF2
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Formatted hash string: pbkdf2$iterations$saltB64$hashB64
 */
export async function hashPassword(password) {
    const iterations = 100000;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
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
    
    const hashArray = new Uint8Array(hashBuffer);
    const saltB64 = btoa(String.fromCharCode(...salt));
    const hashB64 = btoa(String.fromCharCode(...hashArray));
    
    return `pbkdf2$${iterations}$${saltB64}$${hashB64}`;
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password to verify
 * @param {string} storedHash - Stored hash string
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(password, storedHash) {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
        throw new Error('Invalid hash format');
    }
    
    const iterations = parseInt(parts[1]);
    const saltB64 = parts[2];
    const hashB64 = parts[3];
    
    // Decode salt
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    
    // Hash the provided password with same salt
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
    
    const hashArray = new Uint8Array(hashBuffer);
    const computedHashB64 = btoa(String.fromCharCode(...hashArray));
    
    return computedHashB64 === hashB64;
}

/**
 * Generate a random token for sessions
 * @param {number} length - Length of token in bytes (default 32)
 * @returns {string} - Hex-encoded token
 */
export function generateToken(length = 32) {
    const buffer = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Hash a token using SHA-256
 * @param {string} token - Token to hash
 * @returns {Promise<string>} - Hex-encoded hash
 */
export async function hashToken(token) {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generate a UUID v4
 * @returns {string} - UUID string
 */
export function generateUUID() {
    return crypto.randomUUID();
}
