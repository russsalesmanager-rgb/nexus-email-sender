# Production Deployment Checklist

Use this checklist to ensure a smooth deployment to Cloudflare Pages.

## Pre-Deployment

### 1. Domain & DNS Setup
- [ ] Domain added to Cloudflare
- [ ] SSL/TLS certificate active
- [ ] Custom domain configured (optional, can use Pages subdomain)

### 2. Email Infrastructure
- [ ] Sender domain verified
- [ ] SPF record configured: `v=spf1 include:_spf.google.com ~all`
- [ ] DKIM keys generated and DNS records added
- [ ] DMARC policy configured: `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com`
- [ ] Sender email addresses created

### 3. Cloudflare Resources Created

#### D1 Database
```bash
# Create production database
npx wrangler d1 create nexus-email-sender-db-prod

# Note the database_id: ___________________
```

- [ ] D1 database created
- [ ] Database ID saved

#### KV Namespace
```bash
# Create production KV
npx wrangler kv:namespace create RATE_LIMIT_KV --env production

# Note the id: ___________________
```

- [ ] KV namespace created
- [ ] KV ID saved

#### Turnstile Site
- [ ] Turnstile site created for production domain
- [ ] Site Key saved: ___________________
- [ ] Secret Key saved: ___________________

### 4. Repository Setup
- [ ] Code pushed to GitHub
- [ ] All sensitive data removed from code
- [ ] .gitignore configured properly
- [ ] README documentation complete

## Deployment

### 1. Connect Repository to Cloudflare Pages
- [ ] Navigate to Pages in Cloudflare Dashboard
- [ ] Click "Create a project" > "Connect to Git"
- [ ] Select repository: russsalesmanager-rgb/nexus-email-sender
- [ ] Configure build settings:
  - Build command: (leave empty)
  - Build output directory: `/`
  - Root directory: (leave empty)
- [ ] Click "Save and Deploy"

### 2. Configure Bindings

#### D1 Database Binding
- [ ] Go to Pages project > Settings > Functions
- [ ] Click "Add binding" under D1 databases
- [ ] Variable name: `DB`
- [ ] D1 database: Select `nexus-email-sender-db-prod`
- [ ] Click "Save"

#### KV Namespace Binding
- [ ] Go to Pages project > Settings > Functions
- [ ] Click "Add binding" under KV namespaces
- [ ] Variable name: `RATE_LIMIT_KV`
- [ ] KV namespace: Select your production KV
- [ ] Click "Save"

### 3. Set Environment Variables
- [ ] Go to Pages project > Settings > Environment variables
- [ ] Click "Add variable" for Production environment
- [ ] Add each variable:

| Variable | Value | Notes |
|----------|-------|-------|
| TURNSTILE_SECRET | [your-secret-key] | From Turnstile dashboard |
| TURNSTILE_SITEKEY | [your-site-key] | From Turnstile dashboard |
| APP_ORIGIN | https://your-domain.com | Your production URL |
| MAIL_FROM_DEFAULT | noreply@yourdomain.com | Default sender email |

- [ ] All environment variables added
- [ ] Click "Save"

### 4. Run Database Migrations
```bash
# Set production database in wrangler.toml or use command flag
npx wrangler d1 execute nexus-email-sender-db-prod --file=./migrations/001_init.sql
npx wrangler d1 execute nexus-email-sender-db-prod --file=./migrations/002_indexes.sql
```

- [ ] Migration 001_init.sql applied
- [ ] Migration 002_indexes.sql applied
- [ ] Database schema verified

### 5. Trigger Deployment
- [ ] Push to main branch or manually trigger deployment
- [ ] Wait for deployment to complete
- [ ] Check deployment logs for errors

## Post-Deployment Verification

### 1. Basic Functionality
- [ ] Visit production URL
- [ ] Page loads without errors
- [ ] Background animation working
- [ ] No console errors

### 2. Authentication
- [ ] Can access signup page
- [ ] Can create new account
- [ ] Receives session cookie
- [ ] Can login with created account
- [ ] Can logout successfully
- [ ] Session persists across page refreshes

### 3. API Health Check
```bash
curl https://your-domain.com/api/health
# Expected: {"status":"ok","timestamp":"...","service":"nexus-email-sender"}
```
- [ ] Health endpoint returns 200 OK

### 4. Core Features

#### Contacts
- [ ] Can create contact
- [ ] Can view contacts list
- [ ] Can edit contact
- [ ] Can delete contact

#### Lists
- [ ] Can create list
- [ ] Can import CSV (test with small sample)
- [ ] Contacts appear in list
- [ ] Can delete list

#### Senders
- [ ] Can create sender identity
- [ ] Sender details save correctly
- [ ] Can view/edit/delete sender

#### Templates
- [ ] Can create template with variables
- [ ] Template saves with HTML and text
- [ ] Can view/edit/delete template

#### Campaigns
- [ ] Can create campaign
- [ ] Can link sender, template, and list
- [ ] Can queue campaign
- [ ] Job count matches list size

### 5. Email Sending

#### Test Send
- [ ] Create test sender with your domain
- [ ] Send test email to your address
- [ ] Email received successfully
- [ ] From/Reply-To headers correct
- [ ] HTML renders correctly
- [ ] Plain text fallback works

#### Campaign Send
- [ ] Queue a small campaign (2-3 contacts)
- [ ] Turnstile widget appears
- [ ] Complete Turnstile challenge
- [ ] Batch sends successfully
- [ ] Check campaign status shows progress
- [ ] All recipients receive emails
- [ ] Template variables replaced correctly

### 6. Security

#### Headers
```bash
curl -I https://your-domain.com
# Check for security headers
```
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] X-XSS-Protection: 1; mode=block

#### Rate Limiting
- [ ] Attempt to send > 30 emails in an hour
- [ ] Verify rate limit error returned
- [ ] Check rate limit reset time

#### Turnstile
- [ ] Send endpoint requires Turnstile token
- [ ] Invalid token rejected
- [ ] Valid token accepted

### 7. Monitoring Setup
- [ ] Enable Cloudflare Analytics
- [ ] Set up error monitoring (optional)
- [ ] Configure email alerts for errors (optional)
- [ ] Review first day of logs

## Production Hardening

### 1. Custom Domain (if not using Pages subdomain)
- [ ] Add custom domain in Pages settings
- [ ] Update DNS records
- [ ] SSL certificate issued
- [ ] Update APP_ORIGIN environment variable
- [ ] Update Turnstile allowed domains

### 2. Performance
- [ ] Test page load speed
- [ ] Verify assets cached correctly
- [ ] Check API response times

### 3. Backup
- [ ] Document database backup strategy
- [ ] Export initial data if needed
- [ ] Save all credentials securely

### 4. Documentation
- [ ] Update README with production URL
- [ ] Document any deployment-specific configurations
- [ ] Share access with team members
- [ ] Create runbook for common issues

## Launch

- [ ] Notify users/team of launch
- [ ] Monitor for first 24 hours
- [ ] Review error logs daily for first week
- [ ] Collect user feedback

## Rollback Plan

If issues occur:
1. Disable custom domain (if applicable)
2. Roll back to previous deployment in Pages dashboard
3. Check recent environment variable changes
4. Review D1 migration history
5. Restore from backup if needed

## Support

- GitHub Issues: https://github.com/russsalesmanager-rgb/nexus-email-sender/issues
- Cloudflare Support: https://dash.cloudflare.com/support

## Notes

Date deployed: ___________________

Deployed by: ___________________

Production URL: ___________________

Issues encountered:
- 
- 
- 

Resolutions:
- 
- 
- 
