const API_BASE_URL = "/api/tmdb";

async function fetchAPI(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;
  
  try {
    console.log(`[API] Fetching: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status_code && data.status_message) {
      throw new Error(`TMDB: ${data.status_message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error.message);
    return { results: [] };
  }
}

function buildUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `/api/tmdb${cleanEndpoint}`;
}

window.APP_CONFIG = { cacheTimeout: 300000 };
window.fetchAPI = fetchAPI;
window.buildUrl = buildUrl;

console.log('✅ Browser config loaded for Vercel');
