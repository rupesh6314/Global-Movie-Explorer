const CLOUDFLARE_WORKER_URL = "https://tmdb-proxy.rupesh-madhuvarsu2005.workers.dev";
const LOCAL_PROXY = "/api/tmdb";

const API_ENDPOINTS = [
  { name: 'Cloudflare', url: CLOUDFLARE_WORKER_URL, timeout: 8000 },
  { name: 'Local', url: LOCAL_PROXY, timeout: 10000 }
];

let currentEndpointIndex = 0;

function buildUrl(endpoint) {
  const base = API_ENDPOINTS[currentEndpointIndex].url.replace(/\/+$/, '');
  const clean = endpoint.replace(/^\/+/, '');
  return `${base}/${clean}`;
}

async function fetchAPI(endpoint, options = {}) {
  const cleanEndpoint = endpoint.replace(/^\/+/, '');

  for (let attempt = 0; attempt < API_ENDPOINTS.length; attempt++) {
    const endpointConfig = API_ENDPOINTS[currentEndpointIndex];
    const base = endpointConfig.url.replace(/\/+$/, '');
    const url = `${base}/${cleanEndpoint}`;

    try {
      console.log(`[API] Trying ${endpointConfig.name}: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpointConfig.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        if (data.status_code && data.status_message) {
          console.warn(`[API] TMDB error in response: ${data.status_message}`);
          throw new Error(`TMDB: ${data.status_message}`);
        }

        console.log(`[API] ✅ Success using ${endpointConfig.name}`);
        currentEndpointIndex = attempt === 0 ? 0 : currentEndpointIndex;
        return data;
      } else {
        const errorText = await response.text().catch(() => '');
        console.warn(`[API] ${endpointConfig.name} returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`[API] ❌ ${endpointConfig.name} failed: ${error.message}`);
    }

    currentEndpointIndex = (currentEndpointIndex + 1) % API_ENDPOINTS.length;
  }

  console.error('[API] All endpoints failed for:', endpoint);
  return { results: [], total_pages: 0, total_results: 0 };
}

window.APP_CONFIG = { workerUrl: CLOUDFLARE_WORKER_URL, cacheTimeout: 300000 };
window.fetchAPI = fetchAPI;
window.buildUrl = buildUrl;

console.log('✅ Browser config loaded with Cloudflare Worker support');