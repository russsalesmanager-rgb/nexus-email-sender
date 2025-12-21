// POST /api/auth/logout
import { handleCORS, addCORSHeaders } from '../../_shared/auth.js';
import {
  parseCookies,
  hashToken,
  deleteSessionCookie,
  successResponse,
  errorResponse,
  logEvent,
} from '../../_shared/utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  try {
    const cookies = parseCookies(request);
    const token = cookies.nxsess;
    
    if (token) {
      // Delete session from database
      const tokenHash = await hashToken(token);
      
      // Get user_id before deleting for logging
      const session = await env.DB
        .prepare('SELECT user_id FROM sessions WHERE token_hash = ?')
        .bind(tokenHash)
        .first();
      
      await env.DB
        .prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(tokenHash)
        .run();
      
      // Log event if we found the session
      if (session) {
        await logEvent(env.DB, session.user_id, 'user.logout', {});
      }
    }
    
    // Create response with cookie deletion
    const response = successResponse({ message: 'Logged out successfully' });
    
    const headers = new Headers(response.headers);
    headers.set('Set-Cookie', deleteSessionCookie());
    
    return addCORSHeaders(
      new Response(response.body, {
        status: response.status,
        headers,
      }),
      env
    );
  } catch (error) {
    console.error('Logout error:', error);
    return addCORSHeaders(
      errorResponse('Server error', error.message, 500),
      env
    );
  }
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
