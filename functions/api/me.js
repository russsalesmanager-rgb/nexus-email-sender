// GET /api/me
import { requireAuth, handleCORS, addCORSHeaders } from '../_shared/auth.js';
import { successResponse } from '../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // Handle CORS
  const corsResponse = handleCORS(request, env);
  if (corsResponse) return corsResponse;
  
  // Require authentication
  const auth = await requireAuth(request, env);
  if (auth.error) return addCORSHeaders(auth.error, env);
  
  return addCORSHeaders(successResponse({ user: auth.user }), env);
}

export async function onRequestOptions(context) {
  return handleCORS(context.request, context.env);
}
