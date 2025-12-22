# Architecture & Technical Decisions

## Overview

Nexus Email Sender is built as a **Cloudflare-native application**, leveraging the entire Cloudflare Workers ecosystem for a truly serverless, globally distributed SaaS.

## Why Cloudflare?

### Traditional Stack (What We Avoided)
```
Frontend: React/Next.js (requires build)
Backend: Node.js/Express on VPS
Database: PostgreSQL on managed service
Queue: Redis/RabbitMQ
Cache: Redis
Storage: S3
CDN: CloudFront

Cost: $50-200/month minimum
Latency: 100-500ms (single region)
Scaling: Manual or expensive auto-scaling
```

### Cloudflare Stack (What We Built)
```
Frontend: Vanilla JS (no build step)
Backend: Workers (V8 isolates)
Database: D1 (SQLite at edge)
Queue: Cloudflare Queues
Cache: KV (global key-value)
Storage: R2 (S3-compatible)
CDN: Built-in (200+ PoPs)

Cost: $0-5/month (free tier covers most startups)
Latency: <50ms (runs at edge, close to users)
Scaling: Automatic, unlimited
```

## Technical Stack Decisions

### Frontend: Vanilla JavaScript (No Framework)

**Decision:** Use modular vanilla JS instead of React/Vue/Svelte

**Reasoning:**
1. **Zero build time** - Edit, refresh, done
2. **Cloudflare Pages optimized** - No build step needed
3. **Smaller bundle** - ~30KB total vs 200KB+ for frameworks
4. **Faster loads** - No hydration, instant interactivity
5. **Less complexity** - No webpack, babel, or build config

**Trade-offs:**
- Manual state management (acceptable for admin UIs)
- More verbose than JSX (but cleaner than template strings)
- No component marketplace (but we don't need it)

**Files:**
- `assets/api.js` - API client (fetch wrapper)
- `assets/router.js` - Hash-based SPA router
- `assets/ui.js` - Toast, modal, form helpers
- `assets/app.js` - Page renderers & app logic

### Backend: Cloudflare Workers (Not Node.js)

**Decision:** Workers with V8 isolates, not containers

**Reasoning:**
1. **Cold start: 0ms** - No container spin-up
2. **Global deployment** - Runs in 200+ data centers
3. **Unlimited scale** - Automatic, no config needed
4. **Cost-effective** - 100k requests/day free
5. **Modern APIs** - Web standards (fetch, crypto, etc.)

**Limitations:**
- No Node.js built-ins (fs, path, etc.) - Use Workers APIs instead
- 10ms CPU time limit per request - Fine for APIs
- 128MB memory limit - More than enough for JSON APIs

**Solution:** Use ES modules, Web Crypto API, Cloudflare-native features

### Database: D1 (SQLite at Edge)

**Decision:** D1 instead of traditional PostgreSQL/MySQL

**Reasoning:**
1. **Serverless** - No connection pools or management
2. **Global read replicas** - Data close to users
3. **SQLite mature** - Battle-tested, fast, reliable
4. **Zero operational overhead** - Cloudflare manages it
5. **Cost-effective** - 5GB free, then $0.75/GB

**Limitations:**
- Write to single region (eventual consistency for reads)
- 25MB per query result
- 1GB per database (can use multiple DBs if needed)

**Our approach:**
- Writes: Always to primary region
- Reads: From edge replicas (eventual consistency OK)
- Transactions: Supported via D1 batch API

**Schema highlights:**
- Multi-tenant isolation via `org_id`
- Proper indexes on all foreign keys
- INTEGER timestamps (Unix epoch in seconds)
- JSON columns for flexible data (tags_json, custom_json)

### Storage: R2 (S3-Compatible Object Storage)

**Decision:** R2 for CSV uploads and file attachments

**Reasoning:**
1. **S3-compatible** - Works with existing tools
2. **No egress fees** - Unlike S3
3. **Global CDN included** - Fast worldwide
4. **Cheap** - $0.015/GB/month storage

**Use cases:**
- CSV import files (preserved for auditing)
- Email attachments (if we add that feature)
- Template images
- Export files (GDPR compliance)

### Cache: KV (Global Key-Value Store)

**Decision:** KV for rate limiting and fast lookups

**Reasoning:**
1. **Eventually consistent** - Fine for rate limits
2. **Global reads** - <10ms response time worldwide
3. **Simple API** - get/put/delete
4. **Cheap** - 100k reads/day free

**Use cases:**
- Rate limit counters (IP-based, user-based)
- Idempotency keys (prevent duplicate sends)
- Feature flags
- Cached analytics (reduce D1 queries)

### Queue: Cloudflare Queues (Job Processing)

**Decision:** Queues for async email sending

**Reasoning:**
1. **Guaranteed delivery** - At-least-once semantics
2. **Batching** - Process up to 100 messages at once
3. **Retries** - Automatic with exponential backoff
4. **Cheap** - 1M operations/month free

**Message format:**
```json
{
  "type": "send_email",
  "message_id": "uuid",
  "inbox_id": "uuid",
  "to": "recipient@example.com",
  "subject": "Subject",
  "html": "Body",
  "text": "Plain text body"
}
```

**Consumer:** Worker's `queue()` handler processes batches

### Coordination: Durable Objects (Stateful Schedulers)

**Decision:** One Durable Object per organization for scheduling

**Reasoning:**
1. **Strongly consistent** - No race conditions
2. **Stateful** - Can track per-org send state
3. **Alarms** - Built-in cron-like scheduling
4. **Coordination** - Ensures only one scheduler per org

**OrgScheduler responsibilities:**
1. Query enrollments due for sending
2. Select appropriate inbox (check limits)
3. Queue send jobs
4. Update enrollment next_run_at
5. Respect rate limits (daily/hourly)

**Alarm:** Triggers every 1 minute to check for due sends

## Security Architecture

### Authentication Flow

```
1. User submits email + password
   ↓
2. Worker hashes password with PBKDF2 (100k iterations)
   ↓
3. Compares hash with stored hash
   ↓
4. Generates random token (256-bit)
   ↓
5. Hashes token with SHA-256 (stores hash only)
   ↓
6. Returns token in HttpOnly cookie
   ↓
7. Future requests: Token hashed & compared with DB
```

**Why PBKDF2?**
- Web Crypto API standard
- Configurable iterations (we use 100k)
- Salt prevents rainbow tables
- Resistant to GPU attacks (with high iterations)

**Why HttpOnly cookies?**
- JavaScript cannot access (XSS protection)
- Automatically sent with requests
- SameSite=Lax prevents CSRF
- Secure flag requires HTTPS

### Multi-Tenancy Isolation

Every query includes `org_id`:

```sql
-- Bad (allows cross-tenant access)
SELECT * FROM contacts WHERE email = ?

-- Good (enforces tenant isolation)
SELECT * FROM contacts WHERE org_id = ? AND email = ?
```

**Middleware ensures:**
1. User is authenticated
2. User's `org_id` is attached to request
3. All queries filtered by `org_id`

### Role-Based Access Control

```
OWNER:
  - Can delete org
  - Can manage billing
  - Can manage team members

ADMIN:
  - Can create/edit/delete all resources
  - Can view analytics
  - Can manage inboxes

MEMBER:
  - Can create contacts, lists, sequences
  - Can view analytics
  - Cannot manage inboxes or team

READONLY:
  - Can view everything
  - Cannot create or edit anything
```

**Implementation:**
- Stored in `users.role` column
- Checked in middleware via `requireRole(['OWNER', 'ADMIN'])`

### Input Validation

Every endpoint validates:
1. Required fields present
2. Data types correct
3. Email format valid
4. String lengths within limits
5. No SQL injection (parameterized queries)
6. No XSS (sanitized before storage)

**Example:**
```javascript
function sanitizeInput(input) {
  return input
    .replace(/[<>]/g, '')  // Remove HTML
    .trim()
    .substring(0, 1000);   // Max length
}
```

### Rate Limiting (TODO - Phase 7)

**Per-IP:**
- Auth endpoints: 5 req/min
- API endpoints: 100 req/min
- Pixel tracking: 120 req/min

**Per-User:**
- API mutations: 60 req/min
- CSV imports: 5 req/hour

**Implementation:** KV with rolling window
```javascript
const key = `ratelimit:${ip}:${endpoint}`;
const count = await env.KV.get(key) || 0;
if (count > limit) return 429;
await env.KV.put(key, count + 1, { expirationTtl: 60 });
```

## Email Sending Architecture

### Why Not Direct SMTP?

**Traditional approach:**
```
App → SMTP connection → Gmail/Outlook
Problems:
- Connection pool management
- Authentication refresh
- Rate limit tracking per account
- Retry logic
- Bounce handling
```

**Our approach:**
```
App → Queue → Durable Object → Provider API → Email
Benefits:
- No persistent connections
- Automatic retries
- Centralized rate limiting
- Easy provider switching
- Audit trail in D1
```

### Sending Flow

```
1. User enrolls contact in sequence
   ↓
2. Enrollment created with next_run_at = NOW + step.wait_days
   ↓
3. OrgScheduler alarm checks every minute
   ↓
4. Finds enrollments where next_run_at <= NOW
   ↓
5. For each enrollment:
   a. Check if contact unsubscribed/suppressed
   b. Select inbox (round-robin, check limits)
   c. Create message record (status: pending)
   d. Queue send job
   ↓
6. Queue consumer receives job
   ↓
7. Call provider API (MailChannels/Gmail/Microsoft)
   ↓
8. Update message record (status: sent/failed)
   ↓
9. Update inbox sent_today counter
   ↓
10. Update enrollment next_run_at (for next step)
```

### Compliance Features

**Unsubscribe:**
- Every email includes unsubscribe link
- Format: `https://app.com/unsubscribe?token=SIGNED_TOKEN`
- Token contains: email + org_id + expiry, HMAC-signed
- One-click unsubscribe (no login required)
- Recorded in `unsubscribes` table

**Suppression:**
- Automatic from bounces (hard bounces)
- Automatic from complaints (spam reports)
- Manual additions by admin
- Checked before every send

**Rate Limits:**
- Per-inbox daily limit (e.g., 500/day)
- Per-inbox hourly limit (e.g., 50/hour)
- Minimum delay between sends (e.g., 60 seconds)
- Tracked in `inboxes` table

**Audit Log:**
- All sends logged to `messages` table
- All actions logged to `events` table
- Queryable for compliance audits

## Website Visitor Tracking Architecture

### Why Build Our Own Pixel?

**Existing tools (Google Analytics, Mixpanel):**
- Expensive ($$$)
- Privacy concerns (GDPR issues)
- Black box (can't customize)
- External dependencies

**Our pixel:**
- Free (storage is cheap)
- Privacy-first (no raw IPs, respects DNT)
- Customizable
- Owned by you

### Pixel Flow

```
1. User adds <script src="/p/SITE_ID.js"></script> to their site
   ↓
2. Script loads (async, non-blocking)
   ↓
3. Checks for Do Not Track header
   ↓
4. If DNT enabled → Exit (respect privacy)
   ↓
5. Read/create anonymous cookie "nx_anon" (UUID)
   ↓
6. Collect: URL, referrer, user agent, timestamp
   ↓
7. Sign with HMAC: sig = HMAC(secret, site_id|anon_id|url|ts)
   ↓
8. POST to /api/pixel/collect
   ↓
9. Worker verifies:
   a. Domain is in allowed_domains
   b. Signature is valid
   c. Timestamp is recent (<5 min)
   d. IP rate limit not exceeded
   ↓
10. Hash IP with salt (SHA-256)
   ↓
11. Extract country/city from CF headers
   ↓
12. Store in pixel_events table
   ↓
13. Return 1x1 GIF
```

### Privacy Features

**No Raw IPs:**
- IP hashed with salt before storage
- Cannot reverse to identify individual

**Do Not Track:**
- Respects DNT browser header
- No data collected if DNT enabled

**Anonymous:**
- Cookie is random UUID, not user ID
- No cross-site tracking

**Domain Allowlist:**
- Only track events from approved domains
- Prevents abuse/unauthorized tracking

**Data Minimization:**
- Store only: URL, referrer, timestamp, country, city
- No device fingerprinting
- No persistent user tracking

## Scalability

### How It Scales

**10 users:**
- Free tier covers everything
- <1ms latency worldwide
- $0/month

**1,000 users:**
- Still mostly free tier
- Maybe $5-10/month for D1 storage
- <10ms latency worldwide

**10,000 users:**
- ~$50-100/month
- Add paid Workers ($5/mo)
- Add more D1 storage
- Still <10ms latency

**100,000+ users:**
- ~$500-1000/month
- Multiple D1 databases (shard by org)
- Paid KV + R2 tiers
- Consider dedicated Durable Objects
- Still <50ms latency (!)

**Comparison:**
- Traditional stack at 100k users: $5,000-10,000/month
- Our stack: ~$500-1000/month (10x cheaper!)

### Bottlenecks & Solutions

**D1 writes:**
- Limit: ~1k writes/second per database
- Solution: Shard by organization (multiple DBs)
- Or: Batch writes via Queue

**KV consistency:**
- Eventual consistency (not always fresh)
- Solution: Use D1 for critical data
- KV only for caches and counters

**Worker CPU time:**
- Limit: 10ms per request
- Solution: Offload heavy work to Queue
- Example: CSV parsing → Queue job

**R2 operations:**
- Limit: Thousands per second
- Solution: Rarely a bottleneck
- Cache reads via KV if needed

## Development Workflow

### Local Development

```bash
# Terminal 1: Worker with local D1
wrangler dev --local --persist

# Terminal 2: Frontend
python3 -m http.server 8000
```

**Benefits:**
- Local SQLite database
- Instant feedback
- No cloud costs during dev

### Testing

**Unit tests:** (TODO)
- Use Vitest for pure functions
- Mock D1, KV, R2 in tests

**Integration tests:** (TODO)
- Use wrangler --local
- Test full request/response cycle

**E2E tests:** (TODO)
- Playwright for frontend
- Test actual user flows

### Deployment

**Preview deployments:**
```bash
git push
# Cloudflare auto-deploys preview
# URL: https://abc123.nexus-email-sender.pages.dev
```

**Production:**
```bash
wrangler deploy
# Worker deployed to production

# Pages auto-deploys from main branch
```

## Cost Breakdown

### Free Tier Limits

| Resource | Free Limit | Typical SaaS Usage |
|----------|------------|-------------------|
| Workers requests | 100k/day | 10k/day = 10% used |
| D1 storage | 5GB | 100MB = 2% used |
| D1 reads | 5M/day | 1M/day = 20% used |
| D1 writes | 100k/day | 10k/day = 10% used |
| KV reads | 100k/day | 10k/day = 10% used |
| KV writes | 1k/day | 100/day = 10% used |
| R2 storage | 10GB | 1GB = 10% used |
| R2 reads | 10M/month | 1M/month = 10% used |
| Queues ops | 1M/month | 100k/month = 10% used |
| Pages builds | Unlimited | - |

**Conclusion:** Free tier handles ~1,000 active users easily.

### Paid Tiers

When you exceed free tier:

- **Workers:** $5/month + $0.50/million requests
- **D1:** $0.75/GB storage + $1/million reads + $1/million writes
- **KV:** $0.50/GB storage + $0.50/million reads + $5/million writes
- **R2:** $0.015/GB/month storage + $0.36/million reads
- **Queues:** $0.40/million operations

**Example:** 10k active users, 1M API requests/month
- Workers: $5 (base) + $0.50 (1M requests) = $5.50
- D1: $0.75 (1GB) + $1 (1M reads) + $1 (100k writes) = $2.75
- KV: $0 (under 1GB) + $0 (under 1M reads)
- R2: $0.015 (1GB storage)
- Queues: $0.40 (1M ops)
- **Total: ~$9/month** 

Compare to AWS:
- ECS Fargate: $50/month (1 vCPU, 2GB RAM)
- RDS PostgreSQL: $30/month (smallest instance)
- ElastiCache Redis: $15/month
- S3: $5/month
- SQS: $1/month
- **Total: ~$100/month** (11x more expensive!)

## Trade-offs & Limitations

### What We Gave Up

1. **Node.js ecosystem** - Can't use Node-only packages
   - Solution: Use Web standard APIs

2. **Long-running processes** - Workers limited to 10ms CPU
   - Solution: Use Queues for async work

3. **Large databases** - D1 has 1GB limit per DB
   - Solution: Shard across multiple DBs if needed

4. **Strong consistency** - KV is eventually consistent
   - Solution: Use D1 for critical data

5. **Traditional ORM** - No Prisma/Sequelize
   - Solution: Raw SQL (it's fine!)

### What We Gained

1. **Global distribution** - 200+ edge locations
2. **Zero cold starts** - Instant response
3. **Infinite scale** - Automatic
4. **Low cost** - 10x cheaper than traditional
5. **Simple ops** - No servers, no containers, no Kubernetes

## Future Improvements

### Phase 5 (Next)
- Implement CRUD APIs
- MailChannels integration
- Sending engine
- Analytics queries

### Phase 6
- Pixel tracking implementation
- Real-time visitor display

### Phase 7
- Turnstile integration
- Advanced rate limiting
- Anomaly detection

### Phase 8
- Performance optimization
- Caching strategies
- Multi-region D1 (when available)

### Long-term
- Gmail/Microsoft OAuth
- Email template builder
- A/B testing
- Predictive sending (ML-based best time to send)
- Slack/Discord integrations
- Zapier/Make integrations

---

## Summary

This architecture is **optimized for**:
- Low cost
- High performance
- Global reach
- Easy scaling
- Simple operations

It's **not optimized for**:
- Maximum flexibility (locked to Cloudflare)
- Existing Node.js codebases (requires rewrite)
- Large monolithic apps (better for microservices)

For a SaaS startup, the trade-offs heavily favor Cloudflare's stack. You get 90% of AWS functionality at 10% of the cost with 10% of the complexity.
