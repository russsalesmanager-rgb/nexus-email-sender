/**
 * Simple but powerful router for Cloudflare Workers
 * Handles path matching, methods, and CORS
 */

export class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * Add a route
   */
  add(method, path, handler) {
    this.routes.push({ method, path, handler });
  }

  // Convenience methods
  get(path, handler) { this.add('GET', path, handler); }
  post(path, handler) { this.add('POST', path, handler); }
  put(path, handler) { this.add('PUT', path, handler); }
  delete(path, handler) { this.add('DELETE', path, handler); }
  options(path, handler) { this.add('OPTIONS', path, handler); }

  /**
   * Match a request to a route
   */
  match(request) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    for (const route of this.routes) {
      if (route.method !== method && route.method !== '*') continue;

      const match = this.matchPath(route.path, path);
      if (match) {
        return { handler: route.handler, params: match };
      }
    }

    return null;
  }

  /**
   * Match a path pattern against actual path
   * Supports :param syntax
   */
  matchPath(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        // Dynamic segment
        const paramName = patternPart.slice(1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        // Static segment doesn't match
        return null;
      }
    }

    return params;
  }

  /**
   * Handle a request
   */
  async handle(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return this.corsResponse();
    }

    const matched = this.match(request);

    if (!matched) {
      return this.jsonResponse({ ok: false, error: 'Not found' }, 404);
    }

    try {
      const response = await matched.handler(request, env, ctx, matched.params);
      return this.addCorsHeaders(response);
    } catch (error) {
      console.error('Route handler error:', error);
      return this.jsonResponse(
        { ok: false, error: 'Internal server error', detail: error.message },
        500
      );
    }
  }

  /**
   * Create a JSON response
   */
  jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a CORS preflight response
   */
  corsResponse() {
    return new Response(null, {
      status = 204,
      headers: this.getCorsHeaders(),
    });
  }

  /**
   * Get CORS headers
   */
  getCorsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*', // TODO: Restrict to APP_ORIGIN in production
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }

  /**
   * Add CORS headers to a response
   */
  addCorsHeaders(response) {
    const newResponse = new Response(response.body, response);
    const corsHeaders = this.getCorsHeaders();
    
    for (const [key, value] of Object.entries(corsHeaders)) {
      newResponse.headers.set(key, value);
    }
    
    return newResponse;
  }
}

/**
 * Parse request body as JSON
 */
export async function parseBody(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

/**
 * Get query parameters from request
 */
export function getQueryParams(request) {
  const url = new URL(request.url);
  const params = {};
  
  for (const [key, value] of url.searchParams) {
    params[key] = value;
  }
  
  return params;
}

/**
 * Get cookie from request
 */
export function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }

  return null;
}

/**
 * Create a response with a cookie
 */
export function setCookie(response, name, value, options = {}) {
  const {
    maxAge = 86400 * 7, // 7 days
    path = '/',
    httpOnly = true,
    secure = true,
    sameSite = 'Lax',
  } = options;

  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (maxAge) cookie += `; Max-Age=${maxAge}`;
  if (path) cookie += `; Path=${path}`;
  if (httpOnly) cookie += '; HttpOnly';
  if (secure) cookie += '; Secure';
  if (sameSite) cookie += `; SameSite=${sameSite}`;

  response.headers.append('Set-Cookie', cookie);
  return response;
}
