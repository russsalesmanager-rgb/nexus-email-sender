# Nexus Email Sender - Deployment Guide

## Quick Start (5 Minutes)

This guide will get you from zero to deployed in about 5 minutes.

### Prerequisites Checklist

- [ ] Cloudflare account (free tier works)
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] 5 minutes of your time

### Step 1: Install Wrangler

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

This opens your browser to authenticate with Cloudflare.

### Step 2: Create Database

```bash
# Create D1 database
wrangler d1 create nexus-db
```

**Copy the output!** You'll see something like:
```
database_id = "abc123-def456-ghi789"
```

Open `wrangler.toml` and replace `YOUR_D1_DATABASE_ID` with your actual ID.

### Step 3: Run Migrations

```bash
wrangler d1 execute nexus-db --file=./migrations/001_init.sql
```

This creates all tables. You should see `SUCCESS` messages.

### Step 4: Create KV Namespace

```bash
wrangler kv:namespace create "NEXUS_KV"
```

**Copy the output!** You'll see:
```
id = "xyz789abc123def456"
```

Open `wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID` with your actual ID.

### Step 5: Create R2 Bucket

```bash
wrangler r2 bucket create nexus-uploads
```

You should see: `Created bucket 'nexus-uploads'`

### Step 6: Create Queue

```bash
wrangler queues create send-jobs
```

### Step 7: Set Secrets

```bash
# Generate and set encryption key (required)
openssl rand -base64 32 | wrangler secret put ENCRYPTION_KEY_B64

# Generate and set IP hash salt (required)
openssl rand -base64 32 | wrangler secret put IP_HASH_SALT

# Turnstile (optional - for bot protection)
# Get from: https://dash.cloudflare.com/?to=/:account/turnstile
# wrangler secret put TURNSTILE_SITEKEY
# wrangler secret put TURNSTILE_SECRET
```

### Step 8: Deploy Worker

```bash
wrangler deploy
```

You'll see:
```
Published nexus-email-sender
  https://nexus-email-sender.YOUR_SUBDOMAIN.workers.dev
```

**Copy that URL!** You'll need it.

### Step 9: Deploy Pages

Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/?to=/:account/pages):

1. Click "Create a project"
2. Connect your GitHub repo
3. Configure:
   - **Project name**: `nexus-email-sender`
   - **Build command**: (leave empty)
   - **Build output directory**: `/`
4. Click "Save and Deploy"

Wait ~1 minute for deployment.

### Step 10: Set Pages Environment Variable

In Cloudflare Dashboard → Pages → nexus-email-sender → Settings → Environment Variables:

Add:
```
APP_ORIGIN = https://nexus-email-sender.pages.dev
```

(Replace with your actual Pages URL)

### Step 11: Test It!

Visit your Pages URL: `https://nexus-email-sender.pages.dev`

You should see the Nexus login screen!

**Try it:**
1. Click login (you'll need to create an account first)
2. The signup isn't in the UI yet, so use the API directly:

```bash
curl -X POST https://nexus-email-sender.YOUR_SUBDOMAIN.workers.dev/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "org_name": "My Company"
  }'
```

3. Now login in the UI with those credentials!

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Cloudflare Pages)                            │
│  ├─ index.html (SPA entry)                              │
│  └─ assets/ (modular JS)                                │
│     ├─ api.js (fetch wrapper)                           │
│     ├─ router.js (hash routing)                         │
│     ├─ ui.js (components)                               │
│     └─ app.js (pages)                                   │
└─────────────────────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Worker (Cloudflare Workers)                            │
│  ├─ Router (API endpoints)                              │
│  ├─ Auth Middleware                                     │
│  ├─ Queue Consumer                                      │
│  └─ Durable Objects                                     │
└─────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
    │  D1  │      │  KV  │      │  R2  │      │Queue │
    │SQLite│      │Cache │      │Store │      │Jobs  │
    └──────┘      └──────┘      └──────┘      └──────┘
```

## What's Implemented

### ✅ Frontend
- Single-page app with hash routing
- Login/logout UI
- Dashboard, contacts, lists, inboxes, sequences pages (UI only)
- Website visitor tracking page (UI only)
- Settings page
- Toast notifications
- Modal system
- Form builder

### ✅ Backend
- Complete auth system (signup, login, logout, sessions)
- PBKDF2 password hashing (100k iterations)
- HttpOnly session cookies (7-day expiry)
- Multi-tenant database schema
- Role-based access control
- Input validation & sanitization
- CORS handling
- Health check endpoint

### ✅ Database
- 15 tables covering:
  - Organizations & users
  - Contacts & lists
  - Email inboxes
  - Sequences & steps
  - Enrollments & messages
  - Unsubscribes & suppression
  - Events (audit log)
  - Website visitor tracking
- Proper indexes for performance
- Foreign key constraints

### ✅ Security
- Security headers (_headers file)
- PBKDF2 for passwords
- Token hashing for sessions
- HttpOnly, Secure, SameSite cookies
- Email validation
- Input sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention

## What's NOT Implemented Yet (Phase 5+)

These features have database schema and UI, but need backend API implementation:

- **Contacts CRUD** - API endpoints needed
- **Lists CRUD** - API endpoints needed
- **CSV Import** - Upload to R2 + parsing
- **Inboxes** - Provider integration (MailChannels/Gmail/Microsoft)
- **Sequences** - CRUD + enrollment logic
- **Sending Engine** - Durable Objects scheduler + Queue processing
- **Compliance** - Unsubscribe links, suppression checking
- **Analytics** - Aggregation queries
- **Pixel Tracking** - JavaScript snippet + collection endpoint

**Estimate:** ~2-3 days of focused development to complete Phase 5.

## Provider Setup

### Option 1: MailChannels (Fastest)

MailChannels is the quickest to integrate:

1. Sign up at [MailChannels](https://www.mailchannels.com/)
2. Add your domain
3. Set DNS records:
   ```
   TXT @ "v=spf1 include:_spf.mailchannels.net ~all"
   ```
4. Get API key
5. Add to Worker:
   ```javascript
   await fetch('https://api.mailchannels.net/tx/v1/send', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       personalizations: [{ to: [{ email: 'recipient@example.com' }] }],
       from: { email: 'sender@yourdomain.com', name: 'Your Name' },
       subject: 'Subject',
       content: [{ type: 'text/html', value: 'HTML body' }]
     })
   });
   ```

### Option 2: Gmail OAuth

More complex but free for personal use:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `https://your-domain/api/auth/gmail/callback`
6. Implement OAuth flow in Worker
7. Store refresh token (encrypted) in `inboxes` table

### Option 3: Microsoft OAuth

Similar to Gmail:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register application
3. Add Microsoft Graph permissions
4. Create OAuth flow
5. Store tokens in `inboxes` table

## Troubleshooting

### "Database not found"
- Run: `wrangler d1 list` to verify it exists
- Check `wrangler.toml` has correct `database_id`
- Run migrations: `wrangler d1 execute nexus-db --file=./migrations/001_init.sql`

### "KV namespace not found"
- Run: `wrangler kv:namespace list`
- Check `wrangler.toml` has correct `id`

### "CORS error"
- Ensure Worker is deployed
- Check `APP_ORIGIN` env var in Pages settings
- Verify Router adds CORS headers

### "Invalid credentials" on login
- Verify user exists: `wrangler d1 execute nexus-db --command "SELECT email FROM users"`
- Try creating new user via API (see Step 11 above)
- Check password length (min 8 characters)

### Worker not routing API calls
- Verify Worker is deployed: `wrangler deployments list`
- Check Worker URL in browser: `https://YOUR_WORKER.workers.dev/api/health`
- Should return: `{"ok":true,"status":"healthy"}`

## Development Workflow

### Local Development

```bash
# Terminal 1: Start Worker
wrangler dev --local

# Terminal 2: Start frontend
python3 -m http.server 8000
# Or: npx http-server .
```

Access: http://localhost:8000

**Note:** Local D1 uses SQLite file. Run migrations locally:
```bash
wrangler d1 execute nexus-db --local --file=./migrations/001_init.sql
```

### View Logs

```bash
# Live logs
wrangler tail

# Or in Cloudflare Dashboard → Workers → nexus-email-sender → Logs
```

### Query Database

```bash
# List tables
wrangler d1 execute nexus-db --command "SELECT name FROM sqlite_master WHERE type='table'"

# Count users
wrangler d1 execute nexus-db --command "SELECT COUNT(*) FROM users"

# View orgs
wrangler d1 execute nexus-db --command "SELECT * FROM orgs"
```

## Cost Estimation

Cloudflare's free tier is generous:

| Service | Free Tier | Typical Usage | Cost |
|---------|-----------|---------------|------|
| Workers | 100k req/day | 10k req/day | $0 |
| D1 | 5GB storage, 5M reads, 100k writes | 100MB, 1M reads, 10k writes | $0 |
| KV | 100k reads, 1k writes/day | 10k reads, 100 writes | $0 |
| R2 | 10GB storage, 10M reads | 1GB, 1M reads | $0 |
| Pages | Unlimited | - | $0 |
| Queues | 1M operations/month | 100k ops | $0 |

**Total free tier:** Suitable for ~10k active users!

**Paid tier starts at:**
- Workers: $5/month for 10M requests
- D1: $0.75/GB storage + $1/M reads
- Everything else scales affordably

## Production Checklist

Before going live:

- [ ] Custom domain configured in Cloudflare
- [ ] SSL/TLS verified
- [ ] Turnstile enabled for auth endpoints
- [ ] Rate limiting implemented
- [ ] Error monitoring set up (e.g., Sentry)
- [ ] Backup strategy for D1
- [ ] GDPR/privacy policy added
- [ ] Terms of service added
- [ ] Unsubscribe page created
- [ ] Email sending provider tested (MailChannels/Gmail)
- [ ] Compliance footers in emails
- [ ] SPF, DKIM, DMARC records set
- [ ] Test emails sent and received successfully

## Support & Next Steps

### Need Help?

1. Check [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
2. Check [D1 Docs](https://developers.cloudflare.com/d1/)
3. Open GitHub issue in this repo

### Contributing

Want to complete Phase 5 (CRUD APIs)?

1. Fork repo
2. Implement API endpoints in `worker/routes/`
3. Follow existing patterns (auth.js)
4. Test with Postman/Insomnia
5. Submit PR

### Commercial Support

This is a production-ready foundation. If you need:
- Custom features
- Faster implementation
- Managed hosting
- White-label version

Contact: [your email]

---

**Congratulations! 🎉**

You now have a production-grade multi-tenant SaaS foundation running on Cloudflare's edge network!

The hard parts (auth, multi-tenancy, database schema, security) are done. Now you can focus on building features specific to your use case.
