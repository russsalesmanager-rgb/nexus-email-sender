// Database utility functions

// Log an event for auditing
export async function logEvent(db, userId, type, payload) {
    const id = crypto.randomUUID();
    const payloadJson = JSON.stringify(payload);
    
    try {
        await db.prepare(
            'INSERT INTO events (id, user_id, type, payload_json) VALUES (?, ?, ?, ?)'
        ).bind(id, userId, type, payloadJson).run();
    } catch (error) {
        console.error('Failed to log event:', error);
    }
}

// Get paginated results
export function paginationParams(url) {
    const searchParams = new URL(url).searchParams;
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 100);
    const offset = (page - 1) * limit;
    
    return { page, limit, offset };
}

// Parse JSON safely
export function parseJSON(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch {
        return defaultValue;
    }
}

// Validate email format
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Sanitize user input
export function sanitize(input) {
    if (typeof input !== 'string') return input;
    return input.trim();
}
