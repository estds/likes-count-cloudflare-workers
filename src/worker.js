// src/worker.js
export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(request.url);
  
  // Add CORS headers to all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    // Root endpoint
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response('Hello and welcome', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // API endpoint
    if (url.pathname === '/api' && request.method === 'POST') {
      const method = url.searchParams.get('method');
      
      if (!method || (method !== 'read' && method !== 'update')) {
        return new Response(JSON.stringify({
          error: 'Invalid method. Use ?method=read or ?method=update'
        }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Parse request body
      let requestData;
      try {
        requestData = await request.json();
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      if (!requestData.url) {
        return new Response(JSON.stringify({
          error: 'Missing url parameter in request body'
        }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Base64 decode the URL
      let decodedUrl;
      try {
        decodedUrl = atob(requestData.url);
      } catch (error) {
        return new Response(JSON.stringify({
          status: '204',
          url: null,
          likes: null
        }), {
          headers: corsHeaders,
        });
      }

      // Validate and normalize URL
      const normalizedUrl = validateAndNormalizeUrl(decodedUrl);
      if (!normalizedUrl) {
        return new Response(JSON.stringify({
          status: '204',
          url: null,
          likes: null
        }), {
          headers: corsHeaders,
        });
      }

      // Database operations
      if (method === 'read') {
        const result = await readUrl(env.DB, normalizedUrl);
        return new Response(JSON.stringify(result), {
          headers: corsHeaders,
        });
      } else if (method === 'update') {
        const result = await updateUrl(env.DB, normalizedUrl);
        return new Response(JSON.stringify(result), {
          headers: corsHeaders,
        });
      }
    }

    // 404 for other routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

function validateAndNormalizeUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // Normalize: lowercase domain, remove http/https protocol and trailing slash, remove query parameters
    const normalizedUrl = `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "") || "/"}`;
    
    return normalizedUrl;
  } catch (error) {
    return null;
  }
}

async function readUrl(db, url) {
  try {
    // Check if URL exists
    const existing = await db.prepare('SELECT * FROM urls WHERE url = ?').bind(url).first();
    
    if (existing) {
      return {
        status: '200',
        url: url,
        likes: existing.likes
      };
    } else {
      // Create new row with likes = 0
      await db.prepare('INSERT INTO urls (url, likes) VALUES (?, ?)').bind(url, 0).run();
      return {
        status: '200',
        url: url,
        likes: 0
      };
    }
  } catch (error) {
    console.error('Database error in readUrl:', error);
    throw error;
  }
}

async function updateUrl(db, url) {
  try {
    // Check if URL exists
    const existing = await db.prepare('SELECT * FROM urls WHERE url = ?').bind(url).first();
    
    if (existing) {
      // Increment likes
      const newLikes = existing.likes + 1;
      await db.prepare('UPDATE urls SET likes = ? WHERE url = ?').bind(newLikes, url).run();
      return {
        status: '200',
        url: url,
        likes: newLikes
      };
    } else {
      // Create new row with likes = 1
      await db.prepare('INSERT INTO urls (url, likes) VALUES (?, ?)').bind(url, 1).run();
      return {
        status: '200',
        url: url,
        likes: 1
      };
    }
  } catch (error) {
    console.error('Database error in updateUrl:', error);
    throw error;
  }
}
