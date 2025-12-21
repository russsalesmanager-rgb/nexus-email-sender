/**
 * GET /api/health
 * Health check endpoint
 */

import { jsonResponse } from '../utils.js';

export async function onRequestGet() {
    return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'nexus-email-sender'
    });
}
