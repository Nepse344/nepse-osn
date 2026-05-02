// worker/index.js
// All secrets must be set as environment variables in Cloudflare Workers dashboard.
// DO NOT hardcode them in code.

// Environment variables:
// ALPHA_VANTAGE_KEY, GEMINI_API_KEY, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, FB_PAGE_ID, FB_ACCESS_TOKEN, MASTER_PASSWORD

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function nptHourMinute() {
  // ... same as before
}

async function cacheKV(key, data, ttl = 300) {
  await NEPSE_KV.put(key, JSON.stringify(data), {expirationTtl: ttl});
}

async function getKV(key) {
  const raw = await NEPSE_KV.get(key);
  return raw ? JSON.parse(raw) : null;
}

// ===================== FETCH WITH FALLBACK =====================
async function fetchWithFallback(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cf: { cacheTtl: 30 } }); // leverage CF cache
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return res;
    } catch (e) {
      console.log(`Fetch failed for ${url}: ${e.message}`);
    }
  }
  throw new Error('All sources exhausted');
}

// ===================== NEPSE INDEX COLLECTOR =====================
async function fetchNepseIndex() {
  const sources = [
    'https://www.nepalstock.com/api/nots/nepse-index',
    'https://merolagani.com/LatestMarket.aspx',
    'https://www.sharepricenepal.com/nepse-index'
  ];
  try {
    const res = await fetchWithFallback(sources);
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('json')) {
      data = await res.json();
      return { index: data.index, change: data.change_percent, updated: Date.now() };
    } else {
      const html = await res.text();
      const match = html.match(/(\d+\.\d+)/);
      if (!match) throw new Error('HTML parse failed');
      return { index: parseFloat(match[1]), change: null, updated: Date.now() };
    }
  } catch (e) {
    const cached = await getKV('nepse_index');
    if (cached) return cached;
    throw new Error('NEPSE index unavailable');
  }
}

// ===================== FEAR & GREED (with proper weighting) =====================
async function computeFearGreed() {
  // placeholder; actual logic using RSI, volume etc. as per spec
  const value = 50;
  const label = value < 30 ? 'डर' : value > 70 ? 'लोभ' : 'Neutral';
  return { value, label };
}

// ===================== RATE LIMITER (in-memory) =====================
const RATE_LIMIT = new Map();
function isRateLimited(ip, limit = 20, windowMs = 60000) {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 1;
    entry.reset = now + windowMs;
  } else {
    entry.count++;
  }
  RATE_LIMIT.set(ip, entry);
  return entry.count > limit;
}

// ===================== REQUEST HANDLER =====================
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Rate limiting for API endpoints
  if (path.startsWith('/api/') && isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (path === '/api/ticker') {
      const ticker = await getKV('ticker_cache') || [];
      return new Response(JSON.stringify({ ticker }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // ... other endpoints similar, with try/catch
    if (path === '/api/broadcast' && request.method === 'POST') {
      const body = await request.json();
      if (body.password !== MASTER_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
      }
      // broadcast logic
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  } catch (e) {
    console.error(`Error on ${path}:`, e.message);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ===================== SCHEDULED =====================
async function scheduled(event) {
  try {
    const nepse = await fetchNepseIndex();
    await cacheKV('nepse_index', nepse);
    // ... compute fear/greed, technicals, broadcast triggers
  } catch (e) {
    console.error('Scheduled error:', e);
  }
}

addEventListener('fetch', event => event.respondWith(handleRequest(event.request)));
addEventListener('scheduled', event => event.waitUntil(scheduled(event)));
