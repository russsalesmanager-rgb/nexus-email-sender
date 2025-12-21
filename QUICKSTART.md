# Quick Start Guide - Nexus Email Sender

Get up and running with Nexus Email Sender in 15 minutes.

## Prerequisites

- Cloudflare account (free tier works)
- Node.js installed (for Wrangler CLI)
- Domain (optional, can use Pages subdomain)

## Step 1: Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

## Step 2: Clone and Setup

```bash
git clone https://github.com/russsalesmanager-rgb/nexus-email-sender.git
cd nexus-email-sender
```

## Step 3: Create Database

```bash
# Create D1 database
npx wrangler d1 create nexus-email-sender-db

# Copy the database_id from output
# Edit wrangler.toml and replace the database_id placeholder
```

## Step 4: Create KV Namespace

```bash
# Create KV namespace
npx wrangler kv:namespace create RATE_LIMIT_KV

# Copy the id from output
# Edit wrangler.toml and replace the KV id placeholder
```

## Step 5: Run Migrations

```bash
# Apply database schema
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/001_init.sql
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/002_indexes.sql
```

## Step 6: Setup Turnstile (Bot Protection)

1. Go to https://dash.cloudflare.com/
2. Click on **Turnstile** in the sidebar
3. Click **Add Site**
4. Configure:
   - Domain: `localhost` (for development) or your domain
   - Widget mode: Managed
5. Save **Site Key** and **Secret Key**

## Step 7: Configure Local Environment

Create `.dev.vars` file:

```env
TURNSTILE_SECRET=your-secret-key-here
TURNSTILE_SITEKEY=your-site-key-here
APP_ORIGIN=http://localhost:8788
MAIL_FROM_DEFAULT=noreply@yourdomain.com
```

For testing, you can use Cloudflare's test keys:
- Site Key: `1x00000000000000000000AA`
- Secret Key: `1x00000000000000000000000000000000000`

## Step 8: Start Development Server

```bash
npx wrangler pages dev . --compatibility-date=2024-12-01
```

Visit http://localhost:8788

## Step 9: First Login

1. Click on the login screen (default shows admin@nexus.com)
2. Create a new account with your email
3. You're in! 🎉

## Step 10: Quick Walkthrough

### Add a Sender Identity
1. Go to **Senders & SMTP**
2. Click **+ Add Sender**
3. Fill in:
   - From Name: Your Company
   - From Email: hello@yourdomain.com
   - Reply To: support@yourdomain.com

### Import Contacts
1. Go to **Contacts & Lists**
2. Click **+ Create List** (e.g., "Newsletter")
3. Click **Import CSV** on your list
4. Paste CSV data:
```
email,first_name,last_name
john@example.com,John,Doe
jane@example.com,Jane,Smith
```

### Create a Template
1. Go to **Templates** (in navigation)
2. Click **+ Create Template**
3. Fill in:
   - Name: Welcome Email
   - Subject: Welcome {{first_name}}!
   - HTML: `<h1>Hi {{first_name}}</h1><p>Welcome aboard!</p>`

### Create and Send Campaign
1. Go to **Campaigns**
2. Click **+ Create Campaign**
3. Select:
   - Sender
   - Template
   - List
4. Click **Queue** to prepare emails
5. Click **Send Batch** to send first batch

## Production Deployment

### Deploy to Cloudflare Pages

```bash
# Connect to GitHub
# Go to Pages in Cloudflare Dashboard
# Click "Create a project" > "Connect to Git"
# Select your repository
# Build settings:
#   - Build command: (leave empty)
#   - Build output directory: /
```

### Configure Production

1. In Pages project settings, add D1 binding:
   - Variable: `DB`
   - Database: Select your production D1 database

2. Add KV binding:
   - Variable: `RATE_LIMIT_KV`
   - KV Namespace: Select your production KV

3. Add environment variables:
   - `TURNSTILE_SECRET`
   - `TURNSTILE_SITEKEY`
   - `APP_ORIGIN` (e.g., https://your-site.pages.dev)
   - `MAIL_FROM_DEFAULT`

4. Deploy! 🚀

## Important Notes

### Email Sending
- MailChannels is used for delivery (free on Cloudflare)
- Verify your sender domain's DNS records (SPF, DKIM, DMARC)
- Start with small batches to warm up sender reputation

### Rate Limits
- Default: 200 emails/day per user
- 30 emails/hour per IP
- 25 emails per batch send

### Security
- Sessions expire after 7 days
- Passwords hashed with PBKDF2 (100k iterations)
- All send endpoints protected by Turnstile

## Troubleshooting

### Database errors
```bash
# Check database
npx wrangler d1 info nexus-email-sender-db

# Re-run migrations if needed
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/001_init.sql
```

### Can't send emails
1. Check if sender identity is created
2. Verify Turnstile is configured
3. Check browser console for errors
4. Verify rate limits haven't been exceeded

### Login not working
1. Clear browser cookies
2. Check if you're using the correct email/password
3. Try creating a new account

## Need Help?

- Check the full [README.md](README.md) for detailed documentation
- Review API documentation in README
- Open an issue on GitHub

## Next Steps

- Setup email templates with your branding
- Import your contact lists
- Configure sender identities with your domains
- Test campaigns with small batches
- Monitor delivery and engagement

Happy sending! 📧
