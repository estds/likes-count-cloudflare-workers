# Likes count by Cloudflare Worker

A Cloudflare Worker API for tracking URL likes using D1 database.


## Features

- **GET** `/` - Returns welcome message
- **POST** `/api?method=read` - Read URL likes (creates entry if not exists with likes=0)  
- **POST** `/api?method=update` - Increment URL likes (creates entry if not exists with likes=1)
- CORS support for cross-origin requests
- D1 database integration
- Maxium likes: 100,000

## API Examples

### Read URL likes
```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/api?method=read" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

### Update URL likes  
```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/api?method=update" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

### Response Format

#### Sucessful read or update

```bash
{
  "success": true,
  "url": "example.com/my-page",
  "likes": 42
}
```

#### Errors

```bash
{
  "success": false,
  "message": "<Human readable error message>"
}
```


## Setup and Deployment


### Step 1: Login to Cloudflare

Go to `https://dash.cloudflare.com` and login to your account.

### Step 2: Create D1 Database

Go to D1 database, and add a new database.

In the console of the database, use the following commands to create a single table called `data` with two columns: `url` (TEXT type with UNIQUE and NOT NULL constraints) and `likes` (INTEGER type with default value 0).

```sql
CREATE TABLE data (
    url TEXT UNIQUE NOT NULL,
    likes INTEGER DEFAULT 0
);
```

### Step 3: Create worker

Go to workers page and create a new one.

Add the following database binding:

| Type | Name | Value |
| --- | --- | --- |
| D1 database | `DB` | `<database-created-in-step2>` |

### Step 4: Edit worker code and deploy

Copy-paste the content of 'worker.js' into the worker and deploy.

### Step 5: Set up custom domain (optional)

Set up custom domain if needed.


## Same Domain Protection (optional)

To avoid abussive use, apart from CloudFlare's built-in rate limit, a same-domain protection could be applied.

To enable this feature, set up the following environmental variable in the worker:

| Name | Value |
| --- | --- |
| `SAME_DOMAIN_PROTECTION` | `true` |

If `SAME_DOMAIN_PROTECTION` is not set or set to `false`, this feature is disabled.

When same domain protection is enabled, requests could only be made for domain(s) same to the custom domain(s) set up for the worker. Requests made to the default CloudFlare domain would be blocked. For instance:

- ✅ Host: `likes.mysite.com` + URL: `https://www.mysite.com/page` → **Allowed**
- ❌ Host: `likes.mysite.com` + URL: `https://other.com/page` → **Blocked**
- ❌ Host: `my-worker.workers.dev` + any URL → **Blocked**
- Returns HTTP 403 with message: "Domain not allowed"

## Error Handling

### 🌐 **HTTP Method & Endpoint Errors**

* **Non-POST request to /api endpoint**: `405 - "Method not allowed. Only POST requests are accepted."`
* **Request to non-existent endpoint**: `404 - "Endpoint not found"`

### 📋 **Request Parameter Errors**

* **Missing method query parameter**: `400 - "Missing required query parameter: method"`
* **Invalid method parameter (not read/update)**: `400 - "Invalid method. Must be \"read\" or \"update\""`

### 📄 **Request Body Errors**

* **Empty request body**: `400 - "Request body cannot be empty"`
* **Malformed JSON in request body**: `400 - "Invalid JSON in request body"`
* **Missing url field in JSON**: `400 - "Missing or invalid \"url\" field in request body"`
* **Non-string url field**: `400 - "Missing or invalid \"url\" field in request body"`

### 🔒 **Domain Protection Errors** (when `SAME_DOMAIN_PROTECTION=true`)

* **Cross-domain request**: `403 - "Domain not allowed"`
* **Request from *.workers.dev domain**: `403 - "Domain not allowed"`
* **Missing Host header**: `403 - "Domain not allowed"`
* **Invalid URL format during domain check**: `403 - "Domain not allowed"`

### 🔗 **URL Validation Errors**

* **Malformed URL format**: `400 - "Malformed URL"`
* **Non-HTTP/HTTPS protocol (ftp, file, etc.)**: `400 - "Invalid protocol. Only http and https are allowed"`
* **URL exceeds 65,536 characters**: `400 - "URL exceeds maximum length of 65,536 characters"`
* **URL becomes empty after processing**: `400 - "Processed URL cannot be empty"`

### 💾 **Database & System Errors**

* **Database connection failure**: `500 - "Database operation failed"`
* **Database timeout**: `500 - "Database operation failed"`
* **Database query error**: `500 - "Database operation failed"`
* **Unexpected runtime error**: `500 - "Internal server error"`

## CORS Support

All endpoints include CORS headers to allow cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## License

MIT