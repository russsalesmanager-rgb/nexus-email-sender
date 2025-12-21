/**
 * MailChannels API client for sending emails
 * Documentation: https://mailchannels.zendesk.com/hc/en-us/articles/4565898358413
 */

/**
 * Send an email using MailChannels
 * @param {object} options - Email options
 * @returns {Promise<object>} - Response from MailChannels
 */
export async function sendEmail(options) {
    const {
        from_email,
        from_name,
        to_email,
        to_name,
        reply_to,
        subject,
        html,
        text
    } = options;
    
    const payload = {
        personalizations: [
            {
                to: [
                    {
                        email: to_email,
                        name: to_name || ''
                    }
                ]
            }
        ],
        from: {
            email: from_email,
            name: from_name || ''
        },
        subject,
        content: []
    };
    
    // Add reply-to if provided
    if (reply_to) {
        payload.reply_to = {
            email: reply_to
        };
    }
    
    // Add text content
    if (text) {
        payload.content.push({
            type: 'text/plain',
            value: text
        });
    }
    
    // Add HTML content
    if (html) {
        payload.content.push({
            type: 'text/html',
            value: html
        });
    }
    
    // Send via MailChannels
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`MailChannels error: ${response.status} - ${error}`);
    }
    
    // MailChannels returns 202 Accepted with no body on success
    return {
        success: true,
        status: response.status
    };
}

/**
 * Replace template variables in content
 * @param {string} content - Content with variables like {{first_name}}
 * @param {object} variables - Variable values
 * @returns {string}
 */
export function replaceVariables(content, variables) {
    if (!content) return content;
    
    let result = content;
    
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, value || '');
    }
    
    return result;
}
