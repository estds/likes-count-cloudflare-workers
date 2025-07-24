export default {
  async fetch(request, env, ctx) {
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Root endpoint
      if (path === '/' && request.method === 'GET') {
        return new Response('hello and welcome', {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            ...corsHeaders,
          },
        });
      }

      // API endpoint
      if (path === '/api') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { success: false, message: 'Method not allowed. Only POST requests are accepted.' },
            405,
            corsHeaders
          );
        }

        return await handleApiRequest(request, env, corsHeaders);
      }

      // 404 for any other path
      return jsonResponse(
        { success: false, message: 'Endpoint not found' },
        404,
        corsHeaders
      );

    } catch (error) {
      console.error('Unexpected error:', error);
      return jsonResponse(
        { success: false, message: 'Internal server error' },
        500,
        corsHeaders
      );
    }
  },
};

async function handleApiRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  
  // Validate method parameter
  const method = url.searchParams.get('method');
  if (!method) {
    return jsonResponse(
      { success: false, message: 'Missing required query parameter: method' },
      400,
      corsHeaders
    );
  }

  const methodLower = method.toLowerCase();
  if (methodLower !== 'read' && methodLower !== 'update') {
    return jsonResponse(
      { success: false, message: 'Invalid method. Must be "read" or "update"' },
      400,
      corsHeaders
    );
  }

  // Parse request body
  let body;
  try {
    const text = await request.text();
    if (!text.trim()) {
      return jsonResponse(
        { success: false, message: 'Request body cannot be empty' },
        400,
        corsHeaders
      );
    }
    body = JSON.parse(text);
  } catch (error) {
    return jsonResponse(
      { success: false, message: 'Invalid JSON in request body' },
      400,
      corsHeaders
    );
  }

  // Validate URL in body
  if (!body.url || typeof body.url !== 'string') {
    return jsonResponse(
      { success: false, message: 'Missing or invalid "url" field in request body' },
      400,
      corsHeaders
    );
  }

  // Check domain protection if enabled
  const sameDomainProtection = env.SAME_DOMAIN_PROTECTION === 'true';
  if (sameDomainProtection) {
    const domainCheckResult = validateSameDomain(request, body.url);
    if (!domainCheckResult.valid) {
      return jsonResponse(
        { success: false, message: domainCheckResult.message },
        403,
        corsHeaders
      );
    }
  }

  // Process URL
  let processedUrl;
  try {
    processedUrl = processUrl(body.url);
  } catch (error) {
    return jsonResponse(
      { success: false, message: error.message },
      400,
      corsHeaders
    );
  }

  // Handle database operations
  try {
    if (methodLower === 'read') {
      return await handleReadMethod(env.DB, processedUrl, corsHeaders);
    } else {
      return await handleUpdateMethod(env.DB, processedUrl, corsHeaders);
    }
  } catch (error) {
    console.error('Database error:', error);
    return jsonResponse(
      { success: false, message: 'Database operation failed' },
      500,
      corsHeaders
    );
  }
}

function validateSameDomain(request, requestBodyUrl) {
  try {
    // Get the Host header from the request
    const hostHeader = request.headers.get('Host');
    if (!hostHeader) {
      return { valid: false, message: 'Domain not allowed' };
    }

    // Reject workers.dev domains when protection is enabled
    if (hostHeader.endsWith('.workers.dev')) {
      return { valid: false, message: 'Domain not allowed' };
    }

    // Parse the URL from request body
    let bodyUrl;
    try {
      bodyUrl = new URL(requestBodyUrl);
    } catch (error) {
      return { valid: false, message: 'Domain not allowed' };
    }

    // Extract root domains for comparison
    const workerRootDomain = extractRootDomain(hostHeader);
    const requestRootDomain = extractRootDomain(bodyUrl.hostname);

    // Compare root domains
    if (workerRootDomain !== requestRootDomain) {
      return { valid: false, message: 'Domain not allowed' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, message: 'Domain not allowed' };
  }
}

function extractRootDomain(hostname) {
  // Remove port if present
  const cleanHostname = hostname.split(':')[0];
  
  // Split by dots and get the last two parts (root domain)
  const parts = cleanHostname.split('.');
  if (parts.length < 2) {
    return cleanHostname;
  }
  
  // Return the last two parts joined by dot (e.g., "example.com")
  return parts.slice(-2).join('.');
}

function processUrl(inputUrl) {
  // Check length limit
  if (inputUrl.length > 65536) {
    throw new Error('URL exceeds maximum length of 65,536 characters');
  }

  let parsedUrl;
  try {
    // Try to parse the URL
    parsedUrl = new URL(inputUrl);
  } catch (error) {
    throw new Error('Malformed URL');
  }

  // Validate protocol
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Invalid protocol. Only http and https are allowed');
  }

  // Process URL: convert to lowercase, remove search params and fragments
  let processedUrl = parsedUrl.hostname.toLowerCase();
  
  // Add path if it exists and is not just "/"
  if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
    processedUrl += parsedUrl.pathname;
  }

  // Check if processed URL is empty
  if (!processedUrl || processedUrl.trim() === '') {
    throw new Error('Processed URL cannot be empty');
  }

  return processedUrl;
}

async function handleReadMethod(db, processedUrl, corsHeaders) {
  // Query the database for existing URL
  const result = await db.prepare(
    'SELECT url, likes FROM data WHERE url = ?'
  ).bind(processedUrl).first();

  if (result) {
    return jsonResponse(
      {
        success: true,
        url: result.url,
        likes: result.likes
      },
      200,
      corsHeaders
    );
  } else {
    return jsonResponse(
      {
        success: true,
        url: processedUrl,
        likes: 0
      },
      200,
      corsHeaders
    );
  }
}

async function handleUpdateMethod(db, processedUrl, corsHeaders) {
  // First, check if the URL exists
  const existing = await db.prepare(
    'SELECT url, likes FROM data WHERE url = ?'
  ).bind(processedUrl).first();

  if (existing) {
    // Check if likes would exceed maximum
    if (existing.likes >= 100000) {
      return jsonResponse(
        {
          success: true,
          url: existing.url,
          likes: existing.likes
        },
        200,
        corsHeaders
      );
    }

    // Update existing record
    const newLikes = existing.likes + 1;
    await db.prepare(
      'UPDATE data SET likes = ? WHERE url = ?'
    ).bind(newLikes, processedUrl).run();

    return jsonResponse(
      {
        success: true,
        url: processedUrl,
        likes: newLikes
      },
      200,
      corsHeaders
    );
  } else {
    // Insert new record with likes = 1
    await db.prepare(
      'INSERT INTO data (url, likes) VALUES (?, 1)'
    ).bind(processedUrl).run();

    return jsonResponse(
      {
        success: true,
        url: processedUrl,
        likes: 1
      },
      200,
      corsHeaders
    );
  }
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}