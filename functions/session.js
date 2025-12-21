/**
 * Session management utilities
 */

import { generateToken, hashToken, generateUUID } from './crypto.js';
import { now } from './utils.js';

/**
 * Create a new session for a user
 * @param {D1Database} db
 * @param {string} userId
 * @returns {Promise<{token: string, sessionId: string}>}
 */
export async function createSession(db, userId) {
    const token = generateToken(32);
    const tokenHash = await hashToken(token);
    const sessionId = generateUUID();
    const expiresAt = now() + (7 * 24 * 60 * 60); // 7 days
    
    await db
        .prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
        .bind(sessionId, userId, tokenHash, expiresAt)
        .run();
    
    return { token, sessionId };
}

/**
 * Validate a session token and return user
 * @param {D1Database} db
 * @param {string} token
 * @returns {Promise<object|null>} - User object or null
 */
export async function validateSession(db, token) {
    if (!token) return null;
    
    const tokenHash = await hashToken(token);
    const currentTime = now();
    
    // Find valid session
    const result = await db
        .prepare(`
            SELECT u.id, u.email, s.id as session_id
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            LIMIT 1
        `)
        .bind(tokenHash, currentTime)
        .first();
    
    if (!result) return null;
    
    return {
        id: result.id,
        email: result.email,
        sessionId: result.session_id
    };
}

/**
 * Delete a session
 * @param {D1Database} db
 * @param {string} token
 * @returns {Promise<void>}
 */
export async function deleteSession(db, token) {
    if (!token) return;
    
    const tokenHash = await hashToken(token);
    
    await db
        .prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(tokenHash)
        .run();
}

/**
 * Clean up expired sessions
 * @param {D1Database} db
 * @returns {Promise<void>}
 */
export async function cleanupExpiredSessions(db) {
    const currentTime = now();
    
    await db
        .prepare('DELETE FROM sessions WHERE expires_at <= ?')
        .bind(currentTime)
        .run();
}
