/**
 * GET /api/me
 * Get current authenticated user
 */

import { jsonResponse, errorResponse, getCookie } from '../utils.js';
import { validateSession } from '../session.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    
    try {
        const token = getCookie(request, 'nxsess');
        const user = await validateSession(env.DB, token);
        
        if (!user) {
            return errorResponse('Not authenticated', 401);
        }
        
        return jsonResponse({
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Get me error:', error);
        return errorResponse('Internal server error', 500);
    }
}
