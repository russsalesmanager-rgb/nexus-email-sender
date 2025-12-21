# NEXUS Email Sender

A fully-functional email sender application built for Cloudflare Pages with D1 database and KV storage.

## Features

- 🔐 **Secure Authentication**: Password hashing with PBKDF2, HttpOnly session cookies
- 👥 **Contact Management**: CRUD operations for contacts with tagging support
- 📋 **Email Lists**: Organize contacts into lists with CSV import functionality
- 📝 **Email Templates**: Create reusable email templates with variable substitution
- 📡 **Sender Identities**: Manage multiple sender identities (from address, reply-to)
- 🚀 **Campaign Management**: Create, queue, and send email campaigns
- 📊 **Campaign Status**: Track sent, queued, and failed emails
- 🛡️ **Security**: Cloudflare Turnstile integration, rate limiting via KV
- ✉️ **Email Delivery**: MailChannels API integration for reliable email sending

## Architecture

- **Frontend**: Vanilla JavaScript with modular architecture (no framework)
- **Backend**: Cloudflare Pages Functions (Workers runtime)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV for rate limiting and sessions
- **Email Provider**: MailChannels Send API

## Local Development

### Prerequisites

- Node.js 16+ (for Wrangler CLI)
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler`

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd nexus-email-sender
   ```

2. **Create D1 Database**
   ```bash
   wrangler d1 create nexus-email-db
   ```
   
   Copy the `database_id` from the output and update `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "nexus-email-db"
   database_id = "your-database-id-here"
   ```

3. **Run Database Migrations**
   ```bash
   wrangler d1 execute nexus-email-db --file=./migrations/001_init.sql
   ```

4. **Create KV Namespace**
   ```bash
   wrangler kv:namespace create "nexus-kv"
   ```
   
   Update `wrangler.toml` with the KV namespace ID:
   ```toml
   [[kv_namespaces]]
   binding = "KV"
   id = "your-kv-namespace-id"
   ```

5. **Start Local Development Server**
   ```bash
   wrangler pages dev . --binding DB=nexus-email-db --kv KV
   ```

6. **Access the Application**
   Open your browser to `http://localhost:8788`

## Cloudflare Pages Deployment

### Initial Setup

1. **Create Cloudflare Pages Project**
   - Go to Cloudflare Dashboard → Pages
   - Click "Create a project"
   - Connect your GitHub repository
   - Use these build settings:
     - **Framework preset**: None or "Deploy anything"
     - **Build command**: (leave empty)
     - **Build output directory**: `/` (root)

2. **Configure D1 Database**
   - Create D1 database in Cloudflare Dashboard
   - Run migrations:
     ```bash
     wrangler d1 execute nexus-email-db --file=./migrations/001_init.sql --remote
     ```
   - Bind D1 to your Pages project:
     - Go to Pages → Your Project → Settings → Functions
     - Add D1 database binding named `DB`

3. **Configure KV Namespace**
   - Create KV namespace in Cloudflare Dashboard
   - Bind KV to your Pages project:
     - Go to Pages → Your Project → Settings → Functions
     - Add KV namespace binding named `KV`

4. **Set Environment Variables**
   Go to Pages → Your Project → Settings → Environment variables and add:
   
   - `APP_ORIGIN`: Your deployment URL (e.g., `https://nexus.mailverge.info`)
   - `TURNSTILE_SITEKEY`: Your Cloudflare Turnstile site key (optional but recommended)
   - `TURNSTILE_SECRET`: Your Cloudflare Turnstile secret key (optional but recommended)

### Cloudflare Turnstile Setup (Recommended)

Turnstile provides bot protection for email sending endpoints.

1. Go to Cloudflare Dashboard → Turnstile
2. Create a new site
3. Copy the Site Key and Secret Key
4. Add them as environment variables in your Pages project (see above)

### Deploy

Push to your GitHub repository:
```bash
git push origin main
```

Cloudflare Pages will automatically deploy your application.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/me` - Get current user

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/:id` - Get contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

### Lists
- `GET /api/lists` - List all lists
- `POST /api/lists` - Create list
- `GET /api/lists/:id` - Get list with members
- `PUT /api/lists/:id` - Update list
- `DELETE /api/lists/:id` - Delete list
- `POST /api/lists/:id/import` - Import contacts from CSV

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/:id` - Get template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Senders
- `GET /api/senders` - List senders
- `POST /api/senders` - Create sender
- `GET /api/senders/:id` - Get sender
- `PUT /api/senders/:id` - Update sender
- `DELETE /api/senders/:id` - Delete sender

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/queue` - Queue campaign for sending
- `POST /api/campaigns/:id/send` - Send next batch (25-50 emails)
- `GET /api/campaigns/:id/status` - Get campaign status

### Other
- `POST /api/send` - Send test email
- `GET /api/health` - Health check

## Security Features

### Rate Limiting

The application implements rate limiting via Cloudflare KV:
- **IP-based**: 30 sends per hour per IP
- **User-based**: 300 sends per day per user

Limits can be adjusted in `functions/_shared/utils.js` (`checkRateLimit` function).

### Turnstile Protection

Send endpoints (`/api/send` and `/api/campaigns/:id/send`) are protected by Cloudflare Turnstile to prevent automated abuse.

### Session Security

- Sessions use HttpOnly, Secure, SameSite=Lax cookies
- Session tokens are hashed with SHA-256 before storage
- Passwords are hashed with PBKDF2 (100,000 iterations)

## Email Sending

### MailChannels Integration

The application uses MailChannels API for email delivery. MailChannels is available for free on Cloudflare Workers.

**Note**: Make sure your domain has proper DNS records (SPF, DKIM, DMARC) configured for better deliverability.

### Template Variables

Templates support the following variables:
- `{{first_name}}` - Contact's first name
- `{{last_name}}` - Contact's last name
- `{{email}}` - Contact's email address

### Campaign Workflow

1. **Create Campaign**: Link a list, template, and sender
2. **Queue Campaign**: Creates send jobs for all contacts in the list
3. **Send Batches**: Process jobs in batches of 25-50 emails
4. **Monitor Status**: Check sent, queued, and failed counts

## Project Structure

```
nexus-email-sender/
├── index.html              # Main HTML file (entrypoint)
├── assets/                 # Frontend JavaScript modules
│   ├── api.js             # API wrapper
│   ├── router.js          # Hash router
│   ├── ui.js              # UI utilities (toasts, modals)
│   └── app.js             # Main application logic
├── functions/             # Cloudflare Pages Functions
│   ├── _shared/          # Shared utilities
│   │   ├── utils.js      # Common utilities
│   │   ├── auth.js       # Auth middleware
│   │   └── mailchannels.js # Email sending
│   └── api/              # API endpoints
│       ├── auth/         # Authentication endpoints
│       ├── contacts/     # Contact endpoints
│       ├── lists/        # List endpoints
│       ├── templates/    # Template endpoints
│       ├── senders/      # Sender endpoints
│       ├── campaigns/    # Campaign endpoints
│       ├── send.js       # Test send endpoint
│       ├── me.js         # Current user endpoint
│       └── health.js     # Health check
├── migrations/           # Database migrations
│   └── 001_init.sql     # Initial schema
├── wrangler.toml        # Cloudflare configuration
├── _headers             # Security headers
└── README.md            # This file
```

## Troubleshooting

### "Database not found" error
Make sure you've created the D1 database and run migrations:
```bash
wrangler d1 execute nexus-email-db --file=./migrations/001_init.sql --remote
```

### "KV namespace not found" error
Ensure KV namespace is created and bound to your Pages project.

### Emails not sending
1. Check MailChannels API status
2. Verify sender email domain has proper DNS records
3. Check campaign status for error messages
4. Review Cloudflare Pages Functions logs

### CORS errors
Verify `APP_ORIGIN` environment variable matches your deployment URL.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License - feel free to use this project for any purpose.

## Support

For issues and questions, please open a GitHub issue.
