// Response utilities for consistent API responses

export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify({ ok: true, data }), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

export function errorResponse(error, status = 400) {
    const message = typeof error === 'string' ? error : error.message || 'An error occurred';
    return new Response(JSON.stringify({ ok: false, error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

export function notFoundResponse(message = 'Resource not found') {
    return errorResponse(message, 404);
}

export function unauthorizedResponse(message = 'Unauthorized') {
    return errorResponse(message, 401);
}

export function forbiddenResponse(message = 'Forbidden') {
    return errorResponse(message, 403);
}

export function serverErrorResponse(message = 'Internal server error') {
    return errorResponse(message, 500);
}
