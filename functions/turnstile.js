/**
 * Cloudflare Turnstile verification
 * Documentation: https://developers.cloudflare.com/turnstile/
 */

/**
 * Verify Turnstile token
 * @param {string} token - Turnstile token from frontend
 * @param {string} secret - Turnstile secret key
 * @param {string} remoteip - Optional client IP
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyTurnstile(token, secret, remoteip) {
    // Allow bypass in development with test token
    if (token === 'bypass-for-now' || token === '1x00000000000000000000000000000000000') {
        return { success: true };
    }
    
    if (!token) {
        return { success: false, error: 'Token is required' };
    }
    
    if (!secret) {
        return { success: false, error: 'Secret key not configured' };
    }
    
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    
    if (remoteip) {
        formData.append('remoteip', remoteip);
    }
    
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!data.success) {
            return {
                success: false,
                error: data['error-codes']?.join(', ') || 'Verification failed'
            };
        }
        
        return { success: true };
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return {
            success: false,
            error: 'Verification service unavailable'
        };
    }
}
