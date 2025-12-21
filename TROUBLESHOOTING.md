# Troubleshooting Guide

Common issues and their solutions for Nexus Email Sender.

## Table of Contents
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Email Sending Issues](#email-sending-issues)
- [Rate Limiting Issues](#rate-limiting-issues)
- [Deployment Issues](#deployment-issues)
- [Frontend Issues](#frontend-issues)

## Database Issues

### Error: "Database not found" or "DB is not defined"

**Cause**: D1 binding not configured properly.

**Solution**:
1. Check `wrangler.toml` has correct database_id
2. For local dev: Ensure database exists locally
```bash
npx wrangler d1 info nexus-email-sender-db
```
3. For production: Verify D1 binding in Pages settings
4. Restart dev server after changes

### Error: "no such table: users"

**Cause**: Migrations not applied.

**Solution**:
```bash
# For local development
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/001_init.sql
npx wrangler d1 execute nexus-email-sender-db --file=./migrations/002_indexes.sql

# For production
npx wrangler d1 execute nexus-email-sender-db-prod --file=./migrations/001_init.sql
npx wrangler d1 execute nexus-email-sender-db-prod --file=./migrations/002_indexes.sql
```

### Error: "UNIQUE constraint failed"

**Cause**: Attempting to create duplicate records.

**Common scenarios**:
- Email already exists in contacts
- Contact already in list
- Duplicate session token

**Solution**:
- Check if record exists before creating
- Use update instead of create
- For contacts: Check by email first
- For lists: Use the import-csv endpoint which handles duplicates

## Authentication Issues

### Cannot login / "Invalid credentials"

**Solution**:
1. Verify email and password are correct
2. Check if user exists in database:
```bash
npx wrangler d1 execute nexus-email-sender-db --command="SELECT * FROM users WHERE email='your@email.com'"
```
3. Try creating a new account
4. Clear browser cookies and try again

### Session expired immediately

**Cause**: Cookie not being set or clock skew.

**Solution**:
1. Check browser console for cookie errors
2. Verify `Set-Cookie` header in network tab
3. Ensure browser allows cookies
4. Check system time is correct
5. Verify `APP_ORIGIN` matches actual URL

### "Not authenticated" on every request

**Cause**: Session cookie not sent or middleware issue.

**Solution**:
1. Check cookie exists in browser (DevTools > Application > Cookies)
2. Cookie name should be `nxsess`
3. Verify `credentials: 'same-origin'` in API requests
4. Check CORS headers allow credentials
5. Ensure middleware is loading correctly

## Email Sending Issues

### "No sender found" error

**Cause**: No sender identity created.

**Solution**:
1. Go to Senders section
2. Create at least one sender identity
3. Verify sender email domain is authorized

### Emails not received

**Possible causes and solutions**:

1. **MailChannels error**
   - Check browser console for API errors
   - Verify from_email domain is valid
   - Check spam folder

2. **DNS not configured**
   ```
   Add these DNS records for your domain:
   
   SPF: v=spf1 include:_spf.google.com ~all
   DKIM: (Get keys from your email provider)
   DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

3. **Rate limit exceeded**
   - Check rate limit error message
   - Wait for reset time
   - Reduce batch size

4. **Turnstile verification failed**
   - Check Turnstile widget loaded
   - Verify TURNSTILE_SECRET is correct
   - Try refreshing page

### Template variables not replaced

**Cause**: Variable syntax incorrect or data missing.

**Solution**:
- Use correct syntax: `{{variable_name}}`
- Available variables: `{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{name}}`
- Ensure contacts have the data fields populated
- Check campaign template in database

### MailChannels API errors

**Common errors**:

1. **401 Unauthorized**
   - Not on Cloudflare Workers/Pages (MailChannels free tier requirement)
   - Deploy to Cloudflare to fix

2. **403 Forbidden**
   - Domain not authorized
   - Verify sender domain DNS records

3. **429 Too Many Requests**
   - Sending too fast
   - Reduce batch size
   - Add delay between batches

## Rate Limiting Issues

### "Rate limit exceeded" on every request

**Cause**: KV namespace not configured or corrupt data.

**Solution**:
1. Verify KV binding exists:
```bash
npx wrangler kv:namespace list
```
2. Check binding name is `RATE_LIMIT_KV` in wrangler.toml
3. Clear rate limit data:
```bash
npx wrangler kv:key delete "ratelimit:user:USER_ID:TIMESTAMP" --binding=RATE_LIMIT_KV
```
4. Restart application

### Rate limits not working (no enforcement)

**Cause**: KV binding missing or rate limit code not executing.

**Solution**:
1. Check KV namespace binding in Pages settings
2. Verify `RATE_LIMIT_KV` is bound correctly
3. Check browser console for errors
4. Test with small batch sends

## Deployment Issues

### Build fails on Cloudflare Pages

**Cause**: Build command misconfigured.

**Solution**:
- Build command should be empty
- Build output directory should be `/`
- No build step needed (static files + Functions)

### "Module not found" errors

**Cause**: Import paths incorrect or file missing.

**Solution**:
1. Check all import paths use relative paths
2. Verify file exists at import location
3. Check capitalization matches exactly
4. Ensure no Node.js-only modules used

### Functions not working after deployment

**Cause**: Bindings not configured.

**Solution**:
1. Check Pages > Settings > Functions
2. Verify D1 binding: `DB` → your database
3. Verify KV binding: `RATE_LIMIT_KV` → your KV namespace
4. Add environment variables in Settings > Environment variables
5. Redeploy after adding bindings

### CORS errors in production

**Cause**: APP_ORIGIN mismatch.

**Solution**:
1. Set `APP_ORIGIN` to match your production URL exactly
2. Include protocol: `https://your-domain.com`
3. No trailing slash
4. Redeploy after changing

## Frontend Issues

### Blank screen / "Cannot read property"

**Cause**: JavaScript error preventing app initialization.

**Solution**:
1. Open browser console (F12)
2. Look for red error messages
3. Common issues:
   - API endpoint not responding
   - Missing DOM elements
   - Syntax error in JavaScript

### Router not working / hash navigation broken

**Cause**: Router not initialized or navigation method incorrect.

**Solution**:
1. Check console for Router errors
2. Verify Router.init() called on page load
3. Use `Router.nav('page-name')` for navigation
4. Don't use browser back/forward initially

### Styles not loading / broken layout

**Cause**: CSS not loaded or path incorrect.

**Solution**:
1. Check browser console for 404 errors
2. Verify all CSS is inline in index.html (no external files needed)
3. Clear browser cache (Ctrl+Shift+R)
4. Check for CSS syntax errors

### Turnstile widget not appearing

**Cause**: Script not loaded or site key incorrect.

**Solution**:
1. Check network tab for Turnstile script load
2. Verify `TURNSTILE_SITEKEY` environment variable set
3. Check Turnstile dashboard for site status
4. For development, use test key: `1x00000000000000000000AA`

## Performance Issues

### Slow API responses

**Possible causes**:
1. Database query not optimized
   - Check if indexes are applied (002_indexes.sql)
   - Review query patterns

2. Too many database calls
   - Use JOIN queries instead of multiple queries
   - Implement caching if needed

3. Large datasets
   - Add pagination to list endpoints
   - Limit query results

### Slow page loads

**Solutions**:
1. Check asset caching headers
2. Verify \_headers file is deployed
3. Minimize JavaScript bundle size
4. Use browser caching

## Getting Help

If you can't resolve an issue:

1. **Check logs**:
   ```bash
   # Local development
   Check terminal output where wrangler is running
   
   # Production
   Cloudflare Dashboard > Pages > your-project > Deployments > View logs
   ```

2. **Check database state**:
   ```bash
   # List all users
   npx wrangler d1 execute DB_NAME --command="SELECT * FROM users"
   
   # Check sessions
   npx wrangler d1 execute DB_NAME --command="SELECT * FROM sessions"
   
   # View events log
   npx wrangler d1 execute DB_NAME --command="SELECT * FROM events ORDER BY created_at DESC LIMIT 10"
   ```

3. **Enable debug mode**:
   - Check browser console for detailed errors
   - Look at Network tab for API responses
   - Check response headers

4. **Create GitHub Issue**:
   - Include error messages
   - Describe steps to reproduce
   - Mention environment (local/production)
   - Include relevant logs (sanitize sensitive data)

## Useful Commands

```bash
# Check Wrangler version
npx wrangler --version

# List D1 databases
npx wrangler d1 list

# List KV namespaces
npx wrangler kv:namespace list

# View D1 database info
npx wrangler d1 info nexus-email-sender-db

# Execute SQL query
npx wrangler d1 execute DB_NAME --command="YOUR SQL HERE"

# View KV key
npx wrangler kv:key get KEY_NAME --binding=RATE_LIMIT_KV

# Delete KV key
npx wrangler kv:key delete KEY_NAME --binding=RATE_LIMIT_KV

# View Pages deployments
npx wrangler pages deployment list

# Tail production logs
npx wrangler pages deployment tail
```

## Prevention Tips

1. **Always test locally first**
   - Use `npx wrangler pages dev .`
   - Test all features before deploying

2. **Use version control**
   - Commit frequently
   - Tag releases
   - Can rollback if needed

3. **Monitor regularly**
   - Check Cloudflare Analytics
   - Review error logs weekly
   - Monitor email delivery rates

4. **Keep documentation updated**
   - Document configuration changes
   - Note any workarounds
   - Update README with learnings
