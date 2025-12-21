# Nexus Email Sender

A production-ready email campaign management application built on Cloudflare Pages, Pages Functions, D1, and KV.

## Features

- **Authentication**: Secure signup/login with PBKDF2 password hashing and session management
- **Contact Management**: Import contacts via CSV, organize into lists
- **Email Templates**: Create reusable HTML and plain-text templates with variable substitution
- **Sender Identities**: Manage from addresses and reply-to configurations
- **Campaign Management**: Create campaigns, queue emails, and send in controlled batches
- **Email Delivery**: Integrated with MailChannels for reliable email sending
- **Rate Limiting**: KV-based rate limiting per user and per IP
- **Bot Protection**: Cloudflare Turnstile verification on send endpoints
- **Audit Logging**: Complete event tracking for all actions

## Tech Stack

- **Frontend**: Vanilla JavaScript SPA with hash-based routing
- **Backend**: Cloudflare Pages Functions (Workers runtime)
- **Database**: Cloudflare D1 (SQLite)
- **KV Store**: Cloudflare KV for rate limiting
- **Email**: MailChannels Send API
- **Security**: Cloudflare Turnstile for bot protection

## Prerequisites

- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)
- Domain configured in Cloudflare (for production deployment)

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/russsalesmanager-rgb/nexus-email-sender.git
cd nexus-email-sender
```

### 2. Create D1 database

```bash
# Create D1 database
npx wrangler d1 create nexus-email-sender-db

# Note the database_id from output and update wrangler.toml
```

### 3. Create KV namespace

```bash
# Create KV namespace for rate limiting
npx wrangler kv:namespace create RATE_LIMIT_KV

# Note the id from output and update wrangler.toml
```

### 4. Update wrangler.toml

Update the `database_id` and KV namespace `id` in `wrangler.toml` with the values from above.

### 5. Run database migrations

```bash
# Apply migrations
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/001_init.sql
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/002_indexes.sql
```

### 6. Create .dev.vars file

Create a `.dev.vars` file in the root directory:

```env
TURNSTILE_SECRET=1x00000000000000000000000000000000000
TURNSTILE_SITEKEY=1x00000000000000000000AA
APP_ORIGIN=http://localhost:8788
MAIL_FROM_DEFAULT=noreply@yourdomain.com
```

For local development, you can use Cloudflare's test keys for Turnstile.

### 7. Start local development server

```bash
npx wrangler pages dev . --compatibility-date=2024-12-01
```

Visit `http://localhost:8788` in your browser.

## Cloudflare Pages Deployment

### 1. Connect repository to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
3. Select your repository
4. Configure build settings:
   - **Build command**: (leave empty)
   - **Build output directory**: `/`
   - **Root directory**: (leave empty)

### 2. Create production D1 database

```bash
# Create production database
npx wrangler d1 create nexus-email-sender-db-prod

# Apply migrations
npx wrangler d1 execute nexus-email-sender-db-prod --file=./migrations/001_init.sql
npx wrangler d1 execute nexus-email-sender-db-prod --file=./migrations/002_indexes.sql
```

### 3. Create production KV namespace

```bash
# Create production KV namespace
npx wrangler kv:namespace create RATE_LIMIT_KV --env production
```

### 4. Add D1 and KV bindings in Cloudflare Dashboard

1. Go to your Pages project settings
2. Navigate to **Settings** > **Functions**
3. Add **D1 database bindings**:
   - Variable name: `DB`
   - D1 database: Select your production D1 database
4. Add **KV namespace bindings**:
   - Variable name: `RATE_LIMIT_KV`
   - KV namespace: Select your production KV namespace

### 5. Setup Cloudflare Turnstile

1. Go to **Turnstile** in Cloudflare Dashboard
2. Create a new site
3. Configure:
   - **Domain**: Your production domain (e.g., `nexus.mailverge.info`)
   - **Widget Mode**: Managed
4. Copy the **Site Key** and **Secret Key**

### 6. Configure environment variables

In Cloudflare Pages project settings:

1. Navigate to **Settings** > **Environment variables**
2. Add the following variables for **Production**:
   - `TURNSTILE_SECRET`: Your Turnstile secret key
   - `TURNSTILE_SITEKEY`: Your Turnstile site key
   - `APP_ORIGIN`: Your production URL (e.g., `https://nexus.mailverge.info`)
   - `MAIL_FROM_DEFAULT`: Default sender email address

### 7. Deploy

Push to your main branch, and Cloudflare Pages will automatically deploy.

```bash
git push origin main
```

## Email Sending Setup

This application uses **MailChannels** for email delivery. MailChannels is available for free on Cloudflare Workers/Pages.

### Requirements

1. Your sender email domain must be verified
2. Setup SPF, DKIM, and DMARC records for your domain
3. No additional configuration needed - MailChannels works out of the box on Cloudflare

### Email Best Practices

- Always use verified sender domains
- Add unsubscribe links in email templates
- Monitor bounce rates and feedback loops
- Start with small batches to warm up sender reputation
- Respect rate limits (default: 25 emails per batch)

## API Documentation

### Authentication

#### POST /api/auth/signup
Create a new account.

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /api/auth/login
Login to existing account.

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /api/auth/logout
Logout current session.

#### GET /api/me
Get current authenticated user.

### Contacts

#### GET /api/contacts
List all contacts.

#### POST /api/contacts
Create a contact.

```json
{
  "email": "contact@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "tags": ["customer", "vip"]
}
```

#### GET /api/contacts/:id
Get a single contact.

#### PUT /api/contacts/:id
Update a contact.

#### DELETE /api/contacts/:id
Delete a contact.

### Lists

#### GET /api/lists
List all lists.

#### POST /api/lists
Create a list.

```json
{
  "name": "Newsletter Subscribers"
}
```

#### GET /api/lists/:id
Get a single list with contacts.

#### PUT /api/lists/:id
Update a list.

#### DELETE /api/lists/:id
Delete a list.

#### POST /api/lists/:id/import-csv
Import contacts from CSV.

```json
{
  "csv": "email,first_name,last_name\njohn@example.com,John,Doe\njane@example.com,Jane,Smith"
}
```

### Templates

#### GET /api/templates
List all templates.

#### POST /api/templates
Create a template.

```json
{
  "name": "Welcome Email",
  "subject": "Welcome {{first_name}}!",
  "html": "<h1>Hi {{first_name}}</h1><p>Welcome to our platform!</p>",
  "text": "Hi {{first_name}}, Welcome to our platform!"
}
```

**Available variables**: `{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{name}}`

#### GET /api/templates/:id
Get a single template.

#### PUT /api/templates/:id
Update a template.

#### DELETE /api/templates/:id
Delete a template.

### Senders

#### GET /api/senders
List all sender identities.

#### POST /api/senders
Create a sender.

```json
{
  "from_name": "Nexus Team",
  "from_email": "hello@yourdomain.com",
  "reply_to": "support@yourdomain.com"
}
```

#### GET /api/senders/:id
Get a single sender.

#### PUT /api/senders/:id
Update a sender.

#### DELETE /api/senders/:id
Delete a sender.

### Campaigns

#### GET /api/campaigns
List all campaigns.

#### POST /api/campaigns
Create a campaign.

```json
{
  "name": "Summer Newsletter",
  "sender_id": "sender-uuid",
  "template_id": "template-uuid",
  "list_id": "list-uuid",
  "status": "draft"
}
```

#### GET /api/campaigns/:id
Get a single campaign.

#### PUT /api/campaigns/:id
Update a campaign.

#### DELETE /api/campaigns/:id
Delete a campaign.

#### POST /api/campaigns/:id/queue
Queue campaign for sending (creates jobs).

#### POST /api/campaigns/:id/send
Send next batch of emails.

```json
{
  "turnstileToken": "token-from-widget"
}
```

#### GET /api/campaigns/:id/status
Get campaign progress.

### Email Sending

#### POST /api/send
Send a single test email.

```json
{
  "to_email": "recipient@example.com",
  "subject": "Test Email",
  "html": "<p>This is a test</p>",
  "text": "This is a test",
  "sender_id": "sender-uuid",
  "turnstileToken": "token-from-widget"
}
```

### Health

#### GET /api/health
Health check endpoint.

## Security Features

1. **Password Hashing**: PBKDF2 with 100,000 iterations
2. **Session Management**: Secure HttpOnly cookies with 7-day expiration
3. **CORS Protection**: Configured origin-based CORS
4. **Security Headers**: X-Frame-Options, X-Content-Type-Options, CSP
5. **Bot Protection**: Turnstile verification on send endpoints
6. **Rate Limiting**: KV-based rate limiting per user and IP
7. **Input Validation**: Email validation, length checks, type validation
8. **SQL Injection Protection**: Prepared statements with parameter binding

## Rate Limits

Default rate limits (configurable):
- 200 emails per day per user
- 30 emails per hour per IP
- 25 emails per batch send

## Troubleshooting

### Database errors
```bash
# Check database status
npx wrangler d1 info nexus-email-sender-db

# Re-run migrations
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/001_init.sql
```

### Email delivery issues
1. Verify sender domain DNS records (SPF, DKIM, DMARC)
2. Check MailChannels status
3. Review event logs in database
4. Start with small batch sizes

### Authentication issues
- Clear browser cookies
- Check session expiration (7 days default)
- Verify database has sessions table

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
