# URL Tracker Cloudflare Worker

A Cloudflare Worker API for tracking URL likes using D1 database.

## Project Structure

```
/
├── src/
│   └── worker.js          # Main worker script
├── migrations/
│   └── 0001_initial.sql   # Database schema
├── wrangler.toml          # Cloudflare configuration
├── package.json           # Node.js dependencies
└── README.md             # This file
```

## Features

- **GET** `/` - Returns welcome message
- **POST** `/api?method=read` - Read URL likes (creates entry if not exists with likes=0)  
- **POST** `/api?method=update` - Increment URL likes (creates entry if not exists with likes=1)
- Base64 URL encoding/decoding
- URL validation (http/https only)
- URL normalization (lowercase domain, remove trailing slash, remove query params)
- CORS support for cross-origin requests
- D1 database integration

## API Examples

### Read URL likes
```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/api?method=read" \
  -H "Content-Type: application/json" \
  -d '{"url":"aHR0cHM6Ly9leGFtcGxlLmNvbS9hcnRpY2xl"}'
```

### Update URL likes  
```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/api?method=update" \
  -H "Content-Type: application/json" \
  -d '{"url":"aHR0cHM6Ly9leGFtcGxlLmNvbS9hcnRpY2xl"}'
```

*Note: `aHR0cHM6Ly9leGFtcGxlLmNvbS9hcnRpY2xl` is base64 encoded `https://example.com/article`*

### Response Format

**Success:**
```json
{
  "status": "200",
  "url": "https://example.com/article",
  "likes": 42
}
```

**Invalid URL:**
```json
{
  "status": "204", 
  "url": null,
  "likes": null
}
```

## Setup and Deployment

### Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`

### Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd url-tracker-worker
npm install
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

### Step 3: Create D1 Database

```bash
# Create the database
wrangler d1 create url-tracker-db
```

This will output a database ID. Copy it and update the `database_id` field in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "url-tracker-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### Step 4: Run Database Migrations

```bash
# Apply migrations to remote database
npm run db:migrate

# Or apply to local database for development
npm run db:migrate:local
```

### Step 5: Deploy

```bash
# Deploy to production
npm run deploy

# Or deploy to staging environment
npm run deploy:staging
```

### Step 6: Test Your Worker

Once deployed, Wrangler will provide your worker URL. Test it:

```bash
# Test welcome endpoint
curl https://your-worker.your-subdomain.workers.dev/

# Test API with base64 encoded URL
curl -X POST "https://your-worker.your-subdomain.workers.dev/api?method=read" \
  -H "Content-Type: application/json" \
  -d '{"url":"aHR0cHM6Ly9leGFtcGxlLmNvbQ=="}'
```

## Development

### Local Development

```bash
# Start local development server
npm run dev
```

This starts the worker at `http://localhost:8787` with hot reloading.

### Database Commands

```bash
# Create database  
npm run db:create

# Apply migrations to remote database
npm run db:migrate

# Apply migrations to local database
npm run db:migrate:local

# Execute SQL commands on remote database
npm run db:console "SELECT * FROM urls LIMIT 10"

# Execute SQL commands on local database  
npm run db:console:local "SELECT * FROM urls LIMIT 10"
```

## URL Normalization

The API normalizes URLs by:

1. Converting domain to lowercase
2. Removing trailing slashes
3. Removing query parameters  
4. Keeping only the protocol, domain, and path

Examples:
- `HTTPS://Example.COM/Article/?param=1` → `https://example.com/article`
- `http://site.com/page/` → `http://site.com/page`

## Error Handling

The API handles various error cases:

- Invalid JSON in request body → 400 error
- Missing URL parameter → 400 error  
- Invalid base64 encoding → 204 response (invalid URL format)
- Invalid URL protocol → 204 response (invalid URL format)
- Database errors → 500 error

## CORS Support

All endpoints include CORS headers to allow cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## License

MIT