# Nexus Email Sender

A production-grade email campaign management application built for Cloudflare Pages + Workers.

## Features

- 🔐 **Secure Authentication** - Email/password signup and login with HttpOnly session cookies
- 👥 **Contact Management** - Import, manage, and organize contacts with tags and lists
- 📧 **Email Campaigns** - Create, schedule, and send bulk email campaigns
- 📨 **Template Management** - Create reusable email templates with variable substitution
- 📡 **Sender Configuration** - Manage sender identities and email service providers
- 📊 **Real-time Analytics** - Track sends, opens, clicks, and campaign performance
- 🛡️ **Abuse Protection** - Cloudflare Turnstile verification and rate limiting
- 📝 **Activity Logging** - Comprehensive event logging for auditing

## Architecture

### Frontend
- Single-page application with hash-based routing
- Vanilla JavaScript (no frameworks required)
- Modular structure under `/assets`
- Responsive UI with loading states and form validation

### Backend
- Cloudflare Pages Functions for API endpoints
- Consistent JSON API responses: `{ok, data?, error?}`
- Proper CORS and security headers

### Database
- **Cloudflare D1** - Primary database for all persistent data
- **Cloudflare KV** - Rate limiting counters and session nonces
- **Cloudflare R2** (optional) - CSV uploads and file storage

### Email Sending
- **MailChannels Send API** - Default email provider (Workers-friendly)
- Batched sending (50 contacts per batch)
- Retry logic for transient failures
- Event logging for all send attempts

## Database Schema

- `users` - User accounts
- `sessions` - Authentication sessions
- `contacts` - Contact database
- `lists` - Contact lists/segments
- `list_members` - Many-to-many relationship
- `senders` - Email sender identities
- `templates` - Email templates
- `campaigns` - Campaign definitions
- `campaign_jobs` - Individual send jobs
- `events` - Activity/audit log

## Setup & Deployment

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- Node.js (for local development)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/russsalesmanager-rgb/nexus-email-sender.git
   cd nexus-email-sender
   ```

2. **Create D1 database**
   ```bash
   wrangler d1 create nexus-db
   ```
   
   Copy the `database_id` from the output and update `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "nexus-db"
   database_id = "YOUR_DATABASE_ID_HERE"
   ```

3. **Create KV namespace**
   ```bash
   wrangler kv:namespace create "nexus-kv"
   ```
   
   Copy the `id` from the output and update `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "KV"
   id = "YOUR_KV_ID_HERE"
   ```

4. **Run database migrations**
   ```bash
   wrangler d1 execute nexus-db --local --file=./migrations/0001_initial_schema.sql
   wrangler d1 execute nexus-db --local --file=./migrations/0002_add_tables.sql
   # Run all migration files in order
   ```

5. **Create .dev.vars file** (for local development)
   ```bash
   cat > .dev.vars << EOF
   TURNSTILE_SECRET=1x0000000000000000000000000000000AA
   TURNSTILE_SITEKEY=1x00000000000000000000AA
   APP_ORIGIN=http://localhost:8788
   MAIL_FROM_DEFAULT=noreply@yourdomain.com
   EOF
   ```

6. **Start local development server**
   ```bash
   wrangler pages dev . --compatibility-date=2024-01-01
   ```

7. **Open browser**
   Navigate to `http://localhost:8788`

### Production Deployment

1. **Create production D1 database**
   ```bash
   wrangler d1 create nexus-db-production
   ```
   
   Run migrations against production:
   ```bash
   wrangler d1 execute nexus-db-production --file=./migrations/0001_initial_schema.sql
   # Run all migration files
   ```

2. **Create production KV namespace**
   ```bash
   wrangler kv:namespace create "nexus-kv" --preview false
   ```

3. **Deploy to Cloudflare Pages**
   ```bash
   # Option 1: Using Wrangler
   wrangler pages publish . --project-name=nexus-email-sender
   
   # Option 2: Using GitHub integration
   # Connect your repository in the Cloudflare Pages dashboard
   # Set build configuration:
   #   - Build command: (leave empty)
   #   - Build output directory: .
   ```

4. **Set environment variables in Cloudflare Dashboard**
   
   Go to Pages > Your Project > Settings > Environment Variables
   
   Add these variables:
   - `TURNSTILE_SECRET` - Your Cloudflare Turnstile secret key
   - `TURNSTILE_SITEKEY` - Your Cloudflare Turnstile site key
   - `APP_ORIGIN` - Your production domain (e.g., https://nexus.yourdomain.com)
   - `MAIL_FROM_DEFAULT` - Default sender email address

5. **Configure DNS for MailChannels**
   
   Add these DNS TXT records to your domain:
   
   ```
   _mailchannels.yourdomain.com TXT "v=mc1 cfid=yourdomain.com"
   ```
   
   This enables MailChannels Domain Lockdown to prevent spoofing.

### Cloudflare Turnstile Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > Turnstile
2. Create a new site
3. Copy the Site Key and Secret Key
4. Add them as environment variables (see above)

## Email Provider Configuration

### MailChannels (Default)

MailChannels is the default provider as it works seamlessly with Cloudflare Workers.

**API Endpoint:** `https://api.mailchannels.net/tx/v1/send`

**DNS Requirements:**
- Add TXT record for Domain Lockdown (see deployment section)
- Ensure SPF, DKIM, and DMARC are configured for your domain

**Rate Limits:**
- Free tier: Check MailChannels documentation
- Implement your own rate limits using the KV store

### Adding Other Providers

To add support for other email providers (SendGrid, Mailgun, etc.):

1. Update the `senders` table to include provider-specific configuration
2. Create provider adapters in `/functions/lib/email-providers/`
3. Update the send endpoint to route to the correct provider

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login and create session
- `POST /api/auth/logout` - Logout and destroy session
- `GET /api/auth/me` - Get current user info

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/:id` - Get contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/contacts/import` - Import contacts from CSV

### Lists
- `GET /api/lists` - List all lists
- `POST /api/lists` - Create new list
- `GET /api/lists/:id` - Get list details
- `PUT /api/lists/:id` - Update list
- `DELETE /api/lists/:id` - Delete list
- `POST /api/lists/:id/members` - Add contacts to list
- `DELETE /api/lists/:id/members` - Remove contacts from list

### Senders
- `GET /api/senders` - List sender identities
- `POST /api/senders` - Create sender identity
- `GET /api/senders/:id` - Get sender details
- `PUT /api/senders/:id` - Update sender
- `DELETE /api/senders/:id` - Delete sender

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/:id` - Get template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/send` - Start sending campaign
- `POST /api/campaigns/:id/batch` - Process next batch of sends

### Other
- `POST /api/send` - Send single email
- `GET /api/events` - Get activity log
- `GET /api/health` - Health check

## Security Features

### Authentication
- Password hashing using WebCrypto PBKDF2
- Secure HttpOnly session cookies
- Session expiration and cleanup

### Rate Limiting
- Per-IP rate limits using Cloudflare KV
- Per-user sending limits
- Configurable thresholds

### Abuse Protection
- Cloudflare Turnstile verification on send endpoints
- Max recipient limits per campaign
- Event logging for audit trail

### Headers
- CORS properly configured
- Security headers on all responses
- X-Frame-Options, X-Content-Type-Options, etc.

## Default Credentials

**For local development only:**
- Email: `admin@nexus.com`
- Password: `admin`

**For production:**
- Create a new account via the signup endpoint
- Change default credentials immediately

## Troubleshooting

### "Database not found"
- Ensure you've created the D1 database and updated `wrangler.toml`
- Run all migrations against your database

### "KV namespace not found"
- Create the KV namespace and update `wrangler.toml`

### "CORS errors"
- Check that `APP_ORIGIN` environment variable matches your domain
- Verify API responses include proper CORS headers

### "Email not sending"
- Verify MailChannels DNS records are configured
- Check that sender email domain has SPF/DKIM/DMARC
- Review event logs in the activity tab
- Ensure rate limits haven't been exceeded

### "Turnstile verification failing"
- Verify TURNSTILE_SECRET and TURNSTILE_SITEKEY are set correctly
- Check that site key matches your domain
- For local dev, use test keys: `1x0000000000000000000000000000000AA`

## Development Workflow

1. Make changes to code
2. Test locally with `wrangler pages dev`
3. Run migrations if schema changed
4. Deploy to staging/production
5. Monitor logs and events

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- API responses use consistent format
- Security best practices are maintained
- Documentation is updated

## License

[Add your license here]

## Support

For issues or questions:
- Open a GitHub issue
- Check troubleshooting section above
- Review Cloudflare Workers documentation

## Acknowledgments

Built with:
- Cloudflare Pages + Workers
- Cloudflare D1 Database
- Cloudflare KV Storage
- MailChannels Send API
- Cloudflare Turnstile
