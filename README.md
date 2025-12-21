# Nexus Email Sender

A production-grade multi-tenant cold email + outreach platform built entirely on Cloudflare's edge infrastructure.

## 🚀 Features

### Core Features (MVP1)
- ✅ **Multi-tenant Authentication** - Email/password signup with organizations and role-based access control
- ✅ **Contact & List Management** - Full CRM with contacts, lists, CSV import, tags, and custom fields
- ✅ **Sending Accounts** - Connect Gmail and Microsoft accounts via OAuth2 (tokens encrypted at rest)
- ✅ **Email Sequences** - Multi-step campaigns with customizable delays
- ✅ **Smart Scheduler** - Durable Object-based coordinator with inbox rotation and rate limiting
- ✅ **Tracking & Analytics** - Open tracking, click tracking, reply detection
- ✅ **Compliance** - Unsubscribe links, suppression lists, bounce handling
- ✅ **Website Visitor Pixel** - Privacy-focused analytics with DNT respect
- ✅ **Audit Logging** - Complete event timeline for all actions

### Technology Stack
- **Frontend**: Vanilla HTML/CSS/JS (no framework) with hash-based SPA routing
- **Backend**: Cloudflare Pages Functions (Workers)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Storage**: Cloudflare R2 (CSV uploads, attachments)
- **Cache/State**: Cloudflare KV (rate limits, idempotency, locks)
- **Queue**: Cloudflare Queues (reliable email sending)
- **Orchestration**: Durable Objects (SendCoordinator per org)

## 📋 Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works for development)
- Wrangler CLI: `npm install -g wrangler`
- Google Cloud Console project (for Gmail OAuth)
- Microsoft Azure AD app (for Microsoft Graph OAuth)

## 🛠 Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/russsalesmanager-rgb/nexus-email-sender.git
cd nexus-email-sender
npm install
```

### 2. Create Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create nexus-db

# Create KV namespace
wrangler kv:namespace create KV_CACHE

# Create R2 bucket
wrangler r2 bucket create nexus-uploads

# Create Queue
wrangler queues create nexus-send-jobs
wrangler queues create nexus-send-dlq
```

### 3. Update wrangler.toml

Update the `wrangler.toml` file with the IDs from the commands above:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nexus-db"
database_id = "YOUR_D1_DATABASE_ID"  # From step 2

[[kv_namespaces]]
binding = "KV_CACHE"
id = "YOUR_KV_NAMESPACE_ID"  # From step 2
```

### 4. Run Database Migrations

```bash
# Local development database
wrangler d1 execute nexus-db --local --file=./migrations/001_init.sql

# Production database (when ready)
wrangler d1 execute nexus-db --file=./migrations/001_init.sql
```

### 5. Configure Secrets

Generate encryption keys and set secrets:

```bash
# Generate a 256-bit encryption key (base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Set secrets (you'll be prompted to enter the value)
wrangler secret put ENCRYPTION_KEY_B64
wrangler secret put SESSION_SECRET
wrangler secret put IP_HASH_SALT
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put MICROSOFT_CLIENT_SECRET
wrangler secret put TURNSTILE_SECRET_KEY
```

### 6. Configure OAuth Applications

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Gmail API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:8788/oauth/google/callback` (development)
   - `https://your-domain.com/oauth/google/callback` (production)
7. Copy **Client ID** and **Client Secret**
8. Update `wrangler.toml` with the Client ID
9. Set the Client Secret: `wrangler secret put GOOGLE_CLIENT_SECRET`

#### Microsoft OAuth Setup
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Name: "Nexus Email Sender"
4. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
5. Redirect URI:
   - Platform: **Web**
   - URI: `http://localhost:8788/oauth/microsoft/callback` (development)
   - Add: `https://your-domain.com/oauth/microsoft/callback` (production)
6. After registration, go to **API permissions** → **Add a permission** → **Microsoft Graph**:
   - `Mail.Send`
   - `User.Read`
   - `offline_access`
7. Go to **Certificates & secrets** → **New client secret**
8. Copy **Application (client) ID** and **Client secret**
9. Update `wrangler.toml` with the Application ID
10. Set the Client Secret: `wrangler secret put MICROSOFT_CLIENT_SECRET`

### 7. Configure Turnstile (Optional but Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Turnstile**
2. Create a new site
3. Add your domains
4. Copy **Site Key** and **Secret Key**
5. Update `wrangler.toml` with the Site Key
6. Set the Secret Key: `wrangler secret put TURNSTILE_SECRET_KEY`

### 8. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:8788`

## 🚢 Production Deployment

### Option 1: Deploy via Cloudflare Pages (Recommended)

1. **Connect GitHub Repository**
   ```bash
   # Push your code to GitHub
   git remote add origin https://github.com/your-username/nexus-email-sender.git
   git push -u origin main
   ```

2. **Create Pages Project**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages**
   - Click **Create a project** → **Connect to Git**
   - Select your repository
   - Build settings:
     - Framework preset: **None**
     - Build command: `echo "No build required"`
     - Build output directory: `.` (root)

3. **Configure Bindings**
   - Go to **Settings** → **Functions** → **Bindings**
   - Add D1 database binding: `DB` → `nexus-db`
   - Add KV namespace binding: `KV_CACHE` → your KV namespace
   - Add R2 bucket binding: `R2_STORAGE` → `nexus-uploads`
   - Add Queue producer binding: `SEND_QUEUE` → `nexus-send-jobs`
   - Add Durable Object binding: `SEND_COORDINATOR` → `SendCoordinator`

4. **Set Environment Variables & Secrets**
   - Go to **Settings** → **Environment variables**
   - Add all variables from `wrangler.toml` [vars] section
   - Add all secrets (encryption keys, OAuth secrets, etc.)

5. **Run Migrations on Production Database**
   ```bash
   wrangler d1 execute nexus-db --file=./migrations/001_init.sql
   ```

6. **Add Custom Domain** (Optional)
   - Go to **Custom domains** → **Set up a custom domain**
   - Follow the DNS configuration steps
   - Update OAuth redirect URIs to use your custom domain

### Option 2: Deploy via Wrangler CLI

```bash
# Deploy to production
wrangler pages deploy .

# Or publish specifically
npm run deploy
```

## 📚 Architecture Overview

### Request Flow

```
User Request → Cloudflare Pages (index.html)
              ↓
Frontend (SPA) → API Endpoints (/api/*)
                  ↓
        Cloudflare Pages Functions
                  ↓
        ┌─────────┴──────────┐
        ↓                    ↓
    D1 Database          KV Cache
        ↓                    ↓
    R2 Storage         Durable Objects
                            ↓
                      Cloudflare Queues
                            ↓
                    Email Providers
                    (Gmail/Microsoft)
```

### Database Schema

The D1 database includes these main tables:

**Core Tables:**
- `orgs` - Organizations
- `users` - Users with role-based access
- `sessions` - Session management

**CRM Tables:**
- `contacts` - Contact database
- `lists` - Contact lists
- `list_members` - List membership

**Sending Tables:**
- `inboxes` - Connected email accounts (OAuth)
- `sequences` - Email campaigns
- `sequence_steps` - Campaign steps
- `enrollments` - Contact enrollments
- `messages` - Sent messages with tracking

**Tracking Tables:**
- `tracking_links` - Click tracking
- `tracking_events` - Open/click events

**Compliance Tables:**
- `unsubscribes` - Unsubscribe requests
- `suppression` - Bounces/complaints

**Pixel Tables:**
- `sites` - Pixel tracking sites
- `pixel_events` - Website visitor events

### API Endpoints

#### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/me` - Get current user

#### Contacts
- `GET /api/contacts` - List contacts (paginated, searchable)
- `POST /api/contacts` - Create contact
- `GET /api/contacts/:id` - Get contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

#### Lists
- `GET /api/lists` - List all lists
- `POST /api/lists` - Create list
- `GET /api/lists/:id` - Get list with contacts
- `DELETE /api/lists/:id` - Delete list
- `POST /api/lists/:id/import` - Import contacts (CSV)
- `POST /api/lists/:id/add-contacts` - Add contacts to list

#### Inboxes (Sending Accounts)
- `GET /api/inboxes` - List connected inboxes
- `POST /api/inboxes/connect/google` - Initiate Google OAuth
- `POST /api/inboxes/connect/microsoft` - Initiate Microsoft OAuth
- `PUT /api/inboxes/:id` - Update inbox settings
- `DELETE /api/inboxes/:id` - Disconnect inbox

#### Sequences (Campaigns)
- `GET /api/sequences` - List sequences
- `POST /api/sequences` - Create sequence
- `GET /api/sequences/:id` - Get sequence with steps
- `PUT /api/sequences/:id` - Update sequence
- `DELETE /api/sequences/:id` - Delete sequence
- `GET /api/sequences/:id/steps` - List steps
- `POST /api/sequences/:id/steps` - Add step
- `DELETE /api/sequences/:id/steps/:stepId` - Delete step
- `POST /api/sequences/:id/enroll` - Enroll contacts
- `GET /api/sequences/:id/status` - Get enrollment stats

#### Sending
- `POST /api/send/test` - Send test email
- `POST /api/sending/start` - Start sending engine
- `POST /api/sending/pause` - Pause sending
- `GET /api/sending/status` - Get sending status

#### Analytics
- `GET /api/analytics/overview?range=7d|30d|90d` - Overall stats
- `GET /api/analytics/sequence/:id` - Sequence-specific stats
- `GET /api/events?limit=50` - Activity timeline

#### Compliance
- `GET /api/suppression` - List suppression
- `POST /api/suppression` - Add to suppression
- `GET /u/unsub?org=...&email=...&sig=...` - Unsubscribe page

#### Website Pixel
- `GET /api/pixel/sites` - List pixel sites
- `POST /api/pixel/sites` - Create site
- `GET /api/pixel/sites/:id` - Get site with snippet
- `DELETE /api/pixel/sites/:id` - Delete site
- `GET /api/pixel/sites/:id/stats?range=24h|7d|30d` - Site analytics
- `GET /p/:siteId.js` - Pixel JavaScript
- `GET /p/:siteId.gif` - Pixel fallback GIF
- `POST /api/pixel/collect` - Collect pixel event

#### Tracking
- `GET /t/o/:code.gif` - Open tracking pixel
- `GET /t/c/:code` - Click tracking redirect

### Security Features

1. **Password Hashing**: PBKDF2 with 100,000 iterations
2. **Session Management**: HttpOnly cookies with SHA-256 token hashing
3. **OAuth Token Encryption**: AES-GCM at rest
4. **Rate Limiting**: IP-based rate limits via KV
5. **CSRF Protection**: State parameter validation for OAuth
6. **Input Validation**: Strict validation on all inputs
7. **Security Headers**: CSP, X-Frame-Options, etc.
8. **IP Privacy**: Hashed IPs with salt (never stored raw)
9. **Turnstile**: Bot protection on sensitive actions

### Privacy & Compliance

- **Do Not Track**: Respected in pixel tracking
- **Unsubscribe**: One-click unsubscribe on all emails
- **Suppression List**: Automatic bounce/complaint handling
- **GDPR-Ready**: IP hashing, data minimization
- **Audit Log**: Complete event timeline

## 🔧 Configuration

### Environment Variables

Set these in your Cloudflare Pages dashboard or via `wrangler.toml`:

```toml
[vars]
APP_ORIGIN = "https://your-domain.com"
GOOGLE_CLIENT_ID = "your-google-client-id"
MICROSOFT_CLIENT_ID = "your-microsoft-client-id"
TURNSTILE_SITE_KEY = "your-turnstile-site-key"
```

### Secrets

Set via `wrangler secret put SECRET_NAME`:

- `ENCRYPTION_KEY_B64` - Base64-encoded 256-bit key for OAuth encryption
- `SESSION_SECRET` - Random string for session signing
- `IP_HASH_SALT` - Random string for IP hashing
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `MICROSOFT_CLIENT_SECRET` - From Azure Portal
- `TURNSTILE_SECRET_KEY` - From Cloudflare Turnstile

## 📖 Usage Guide

### First Steps

1. **Sign Up**: Create your account at `/` (serves `index.html`)
2. **Connect Inbox**: Go to Inboxes → Connect Google or Microsoft account
3. **Import Contacts**: Go to Contacts → Lists → Import CSV
4. **Create Sequence**: Go to Campaigns → Create sequence → Add email steps
5. **Enroll Contacts**: Select sequence → Enroll → Choose list
6. **Start Sending**: Sending → Start engine

### CSV Import Format

```csv
email,first_name,last_name,company,title,phone
john@example.com,John,Doe,Acme Inc,CEO,555-1234
jane@example.com,Jane,Smith,Tech Corp,CTO,555-5678
```

Required columns: `email`

### Pixel Tracking Setup

1. **Create Site**: Pixel → Create site → Add allowed domains
2. **Copy Snippet**: Copy the provided snippet
3. **Add to Website**: Paste before `</head>` tag

```html
<script async src="https://your-domain.com/p/SITE_ID.js"></script>
```

## 🚧 Known Limitations & Roadmap

### Current Limitations
- Queue consumer needs separate worker deployment for actual sending
- Gmail/Microsoft API sending not yet implemented (stubs in place)
- Token refresh logic needs implementation
- No deliverability scoring yet
- No AI email writer yet
- No LinkedIn/SMS steps (only email)

### Planned Improvements
1. **Sending Engine**: Complete Gmail API and Graph API implementations
2. **Warm-up**: Gradual inbox warm-up scheduling
3. **AI Features**: Email content generation, subject line optimization
4. **Deliverability**: Spam score checking, domain health monitoring
5. **LinkedIn Integration**: Automated LinkedIn connection requests and messages
6. **SMS Integration**: Twilio integration for SMS steps
7. **Templates**: Email template library
8. **A/B Testing**: Subject line and content variants
9. **Advanced Analytics**: Cohort analysis, funnel visualization
10. **Webhooks**: Outbound webhooks for integrations

## 🐛 Troubleshooting

### Common Issues

**OAuth redirect mismatch:**
- Ensure redirect URIs in Google/Microsoft console exactly match your domain
- Don't forget to add both local (`localhost:8788`) and production domains

**Database not found:**
- Run migrations: `wrangler d1 execute nexus-db --file=./migrations/001_init.sql`
- Check database ID in `wrangler.toml` matches created database

**Session errors:**
- Ensure `SESSION_SECRET` is set: `wrangler secret put SESSION_SECRET`
- Clear browser cookies and try again

**Pixel not tracking:**
- Check allowed domains match exactly (including subdomain)
- Ensure `IP_HASH_SALT` is set
- Check browser console for errors

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues or questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review Cloudflare Workers documentation

---

**Built with ❤️ on Cloudflare's edge network**
