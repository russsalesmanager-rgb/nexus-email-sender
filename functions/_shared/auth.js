// Auth middleware for protecting API endpoints
import { parseCookies, getUserFromToken, errorResponse } from './utils.js';

/**
 * Middleware to authenticate requests
 * Returns user object if authenticated, or sends error response
 */
export async function requireAuth(request, env) {
  const cookies = parseCookies(request);
  const token = cookies.nxsess;
  
  if (!token) {
    return { error: errorResponse('Unauthorized', 'No session token provided', 401) };
  }
  
  const user = await getUserFromToken(env.DB, token);
  
  if (!user) {
    return { error: errorResponse('Unauthorized', 'Invalid or expired session', 401) };
  }
  
  return { user };
}

/**
 * Handle CORS preflight requests
 */
export function handleCORS(request, env) {
  const origin = request.headers.get('Origin');
  const appOrigin = env.APP_ORIGIN || '*';
  
  // For preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': appOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  return null;
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(response, env) {
  const appOrigin = env.APP_ORIGIN || '*';
  const headers = new Headers(response.headers);
  
  headers.set('Access-Control-Allow-Origin', appOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
