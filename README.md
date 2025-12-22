# Nexus Email Sender - Multi-Tenant Outreach SaaS

A production-grade, multi-tenant email outreach platform built on Cloudflare's edge infrastructure.

## Features

- **Multi-Tenant Architecture**: Complete org isolation with role-based access control
- **Email Sequences**: Multi-step campaigns with delays and personalization
- **Multiple Inbox Support**: Rotate across MailChannels, Gmail, Microsoft accounts
- **Website Visitor Tracking**: Privacy-friendly pixel tracking (no raw IPs stored)
- **Compliance Built-In**: Automatic unsubscribe links, suppression list, rate limits
- **Real-time Analytics**: Track sends, opens, clicks, bounces
- **Durable Objects**: Per-org schedulers for reliable sending
- **Queues**: Distributed job processing for scale

## Tech Stack

- **Frontend**: Vanilla JS (modular), no build step required
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (CSV uploads, attachments)
- **Cache**: Cloudflare KV (rate limits, idempotency)
- **Jobs**: Cloudflare Queues
- **Coordination**: Cloudflare Durable Objects

## Architecture

```
Frontend (Cloudflare Pages)
  ↓
Worker (API + Routing)
  ↓
├─ D1 (SQLite) ─ Multi-tenant data
├─ KV ─ Rate limits, sessions cache
├─ R2 ─ CSV uploads, file attachments
├─ Queues ─ Async send jobs
└─ Durable Objects ─ Per-org schedulers
```

## Prerequisites

- Node.js 18+ (for Wrangler CLI)
- Cloudflare account
- `wrangler` CLI installed: `npm install -g wrangler`

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repo-url>
cd nexus-email-sender
wrangler login
```

### 2. Create Cloudflare Resources

```bash
# Create D1 database
wrangler d1 create nexus-db
# Copy the database_id to wrangler.toml

# Run migrations
wrangler d1 execute nexus-db --file=./migrations/001_init.sql

# Create KV namespace
wrangler kv:namespace create "NEXUS_KV"
# Copy the id to wrangler.toml

# Create R2 bucket
wrangler r2 bucket create nexus-uploads

# Create Queue
wrangler queues create send-jobs
```

### 3. Configure Environment Variables

Set required secrets:

```bash
# Generate a 256-bit (32-byte) encryption key
openssl rand -base64 32 | wrangler secret put ENCRYPTION_KEY_B64

# IP hashing salt
openssl rand -base64 32 | wrangler secret put IP_HASH_SALT

# Turnstile (optional, for rate limiting/bot protection)
wrangler secret put TURNSTILE_SITEKEY
wrangler secret put TURNSTILE_SECRET
```

Update `wrangler.toml` with your IDs:
- `database_id` (from step 2)
- `id` for KV namespace (from step 2)

### 4. Deploy Worker

```bash
wrangler deploy
```

This deploys the Worker to your Cloudflare account.

### 5. Deploy Pages (Frontend)

Two options:

#### Option A: Cloudflare Dashboard
1. Go to Cloudflare Dashboard → Pages
2. Connect your GitHub repository
3. Build settings:
   - Build command: (leave empty)
   - Build output directory: `/`
4. Deploy!

#### Option B: Wrangler CLI
```bash
wrangler pages deploy . --project-name=nexus-email-sender
```

### 6. Connect Worker to Pages

After deploying Pages:

1. Go to Pages settings → Functions
2. Add Service Binding:
   - Variable name: `API`
   - Service: `nexus-email-sender` (your worker name)
3. Or use custom domain routing in `wrangler.toml`

### 7. Configure Environment Variables in Pages

In Cloudflare Dashboard → Pages → Settings → Environment Variables:

```
APP_ORIGIN=https://your-pages-domain.pages.dev
```

## Local Development

```bash
# Start worker in dev mode
wrangler dev

# Or with local D1 (uses SQLite)
wrangler dev --local

# Access at http://localhost:8787
```

For frontend development, use any static server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node
npx http-server .

# Access at http://localhost:8000
```

## Email Providers Setup

### MailChannels (Recommended for MVP)

MailChannels is the fastest to set up:

1. Add your domain to MailChannels
2. Set DNS records (SPF, DKIM, DMARC)
3. Use in Worker via API

### Gmail OAuth

1. Create Google Cloud Project
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Implement OAuth flow in app

### Microsoft OAuth

1. Register app in Azure AD
2. Add Microsoft Graph permissions
3. Implement OAuth flow

## Project Structure

```
nexus-email-sender/
├── index.html              # Main SPA entry
├── assets/                 # Frontend JS modules
│   ├── api.js             # API client
│   ├── router.js          # Hash router
│   ├── ui.js              # UI components
│   └── app.js             # Main app logic
├── worker/                 # Cloudflare Worker
│   ├── index.js           # Worker entry
│   ├── lib/               # Utilities
│   │   ├── router.js      # API router
│   │   ├── crypto.js      # WebCrypto utils
│   │   └── auth-middleware.js
│   ├── routes/            # API route handlers
│   │   └── auth.js        # Auth endpoints
│   └── durable-objects/   # Durable Object classes
│       └── org-scheduler.js
├── migrations/            # D1 SQL migrations
│   └── 001_init.sql
├── wrangler.toml          # Worker config
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/me` - Get current user

### Contacts (TODO)
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

### Lists (TODO)
- `GET /api/lists` - List lists
- `POST /api/lists` - Create list
- `POST /api/lists/:id/import` - Import CSV

### Inboxes (TODO)
- `GET /api/inboxes` - List inboxes
- `POST /api/inboxes` - Connect inbox
- `PUT /api/inboxes/:id` - Update inbox

### Sequences (TODO)
- `GET /api/sequences` - List sequences
- `POST /api/sequences` - Create sequence
- `POST /api/sequences/:id/enroll` - Enroll contacts
- `GET /api/sequences/:id/status` - Get status

### Pixel Tracking (TODO)
- `GET /p/:siteId.js` - Pixel script
- `GET /p/:siteId.gif` - Pixel image
- `POST /api/pixel/collect` - Collect event
- `GET /api/pixel/sites/:id/stats` - Get stats

## Security Features

- **PBKDF2 Password Hashing**: 100,000 iterations with salt
- **HttpOnly Cookies**: Session tokens never exposed to JS
- **Rate Limiting**: Via KV, per-IP and per-user
- **HMAC Signatures**: For pixel events
- **IP Hashing**: No raw IPs stored (SHA-256 + salt)
- **Input Sanitization**: All user input validated
- **CORS**: Configured per-origin
- **Turnstile**: Optional bot protection

## Compliance

- **CAN-SPAM**: Physical address in footers, unsubscribe links
- **GDPR**: Data export, right to deletion
- **Suppression List**: Automatic bounce/complaint handling
- **Rate Limits**: Per-inbox daily/hourly caps
- **Audit Logs**: All actions logged to `events` table

## Monitoring

Use Cloudflare Analytics and Logpush:

```bash
# View logs
wrangler tail

# Analytics
# Check Cloudflare Dashboard → Analytics → Workers
```

## Troubleshooting

### Worker not deploying
- Check `wrangler.toml` for valid IDs
- Ensure all resources created (D1, KV, R2, Queue)
- Run `wrangler deploy --dry-run` to test

### Database errors
- Verify migrations ran: `wrangler d1 execute nexus-db --command "SELECT name FROM sqlite_master WHERE type='table';"`
- Check bindings in `wrangler.toml`

### CORS errors
- Ensure Worker is bound to Pages
- Check `APP_ORIGIN` environment variable

## Roadmap

### Phase 1 ✅
- Frontend normalization
- Modular JS architecture

### Phase 2 ✅ (Partial)
- Worker infrastructure
- Routing and auth

### Phase 3 ✅
- D1 schema
- Migrations

### Phase 4 🚧 (In Progress)
- Complete auth implementation
- Session management

### Phase 5 (Next)
- Contacts/Lists CRUD
- Sequences implementation
- Sending engine
- MailChannels integration

### Phase 6 (Future)
- Pixel tracking
- Analytics
- Dashboard stats

### Phase 7 (Future)
- Turnstile integration
- Advanced rate limiting

### Phase 8 (Future)
- Production hardening
- Performance optimization

## Contributing

This is a production SaaS template. Contributions welcome!

## License

MIT License - see LICENSE file

## Support

- GitHub Issues: <repo-url>/issues
- Documentation: This README
- Cloudflare Docs: https://developers.cloudflare.com/
