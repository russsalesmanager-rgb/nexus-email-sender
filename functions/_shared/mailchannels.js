// MailChannels email sending integration
// https://api.mailchannels.net/tx/v1/send

/**
 * Send an email via MailChannels
 */
export async function sendEmail(params) {
  const {
    fromEmail,
    fromName,
    replyTo,
    toEmail,
    toName,
    subject,
    htmlBody,
    textBody,
  } = params;
  
  const payload = {
    personalizations: [
      {
        to: [
          {
            email: toEmail,
            ...(toName && { name: toName }),
          },
        ],
      },
    ],
    from: {
      email: fromEmail,
      ...(fromName && { name: fromName }),
    },
    ...(replyTo && {
      reply_to: {
        email: replyTo,
      },
    }),
    subject: subject,
    content: [],
  };
  
  // Add text content if provided
  if (textBody) {
    payload.content.push({
      type: 'text/plain',
      value: textBody,
    });
  }
  
  // Add HTML content if provided
  if (htmlBody) {
    payload.content.push({
      type: 'text/html',
      value: htmlBody,
    });
  }
  
  // Ensure at least one content type exists
  if (payload.content.length === 0) {
    throw new Error('Email must have at least text or HTML content');
  }
  
  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MailChannels API error: ${response.status} - ${errorText}`);
    }
    
    // MailChannels returns 202 Accepted on success
    return {
      success: true,
      messageId: response.headers.get('X-Message-Id') || null,
    };
  } catch (error) {
    console.error('MailChannels send error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Replace template variables in content
 */
export function replaceVariables(content, variables) {
  let result = content;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  
  return result;
}
