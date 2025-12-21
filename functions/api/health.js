// GET /api/health - Health check endpoint

import { jsonResponse } from '../lib/response.js';
import { handleCors, addCorsHeaders, addSecurityHeaders } from '../lib/cors.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    
    // Handle CORS preflight
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;
    
    try {
        // Check database connection
        const result = await env.DB.prepare('SELECT 1 as health').first();
        const dbHealthy = result && result.health === 1;
        
        const health = {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            database: dbHealthy ? 'connected' : 'disconnected',
        };
        
        const response = jsonResponse(health);
        return addCorsHeaders(addSecurityHeaders(response), env.APP_ORIGIN);
        
    } catch (error) {
        console.error('Health check error:', error);
        const health = {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
        };
        
        const response = jsonResponse(health, 503);
        return addCorsHeaders(addSecurityHeaders(response), env.APP_ORIGIN);
    }
}

export async function onRequestOptions(context) {
    return handleCors(context.request, context.env);
}
