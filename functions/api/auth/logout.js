/**
 * POST /api/auth/logout
 * End user session
 */

import { jsonResponse, errorResponse, getCookie, deleteCookie } from '../../utils.js';
import { deleteSession } from '../../session.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const token = getCookie(request, 'nxsess');
        
        if (token) {
            await deleteSession(env.DB, token);
        }
        
        const response = jsonResponse({
            success: true,
            message: 'Logged out successfully'
        });
        
        response.headers.set('Set-Cookie', deleteCookie('nxsess'));
        
        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return errorResponse('Internal server error', 500);
    }
}
