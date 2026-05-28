// Enhanced API handler with caching
class APIClient {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[API] Back online');
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[API] Offline mode');
    });
  }

  async fetchAPI(endpoint, options = {}) {
    if (!this.isOnline) {
      console.warn('[API] Offline - using cache if available');
    }

    const cacheKey = endpoint;
    const { forceRefresh = false, timeout = 15000 } = options;

    // Check cache
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      const timeoutLimit = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.cacheTimeout)
        ? APP_CONFIG.cacheTimeout
        : 300000;

      if (Date.now() - timestamp < timeoutLimit) {
        console.log(`[Cache] Hit for: ${endpoint}`);
        return data;
      }
    }

    // Deduplicate in-flight requests
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[Queue] Waiting for pending: ${endpoint}`);
      return this.pendingRequests.get(cacheKey);
    }

    const requestPromise = this.makeRequest(endpoint, timeout);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;
      if (data && !data.errors && !data.status_code) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } catch (error) {
      console.error(`[API Class Error] ${endpoint}: ${error.message}`);
      return { results: [], isError: true };
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async makeRequest(endpoint, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = this.buildUrl(endpoint); // ✅ Always use internal buildUrl
      console.log(`[API] Fetching: ${url}`);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();

      if (data.status_code && data.status_message) {
        throw new Error(`TMDB Error ${data.status_code}: ${data.status_message}`);
      }

      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - TMDB API might be slow');
      }
      throw error;
    }
  }

  // ✅ Fix: strip leading slash from endpoint before joining with base URL
  buildUrl(endpoint) {
    const base = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.workerUrl)
      ? APP_CONFIG.workerUrl
      : (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '');

    // Remove trailing slash from base, leading slash from endpoint
    const cleanBase = base.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');

    return cleanBase ? `${cleanBase}/${cleanEndpoint}` : `/${cleanEndpoint}`;
  }

  clearCache() {
    this.cache.clear();
    console.log('[Cache] Cleared');
  }
}

const apiClient = new APIClient();

async function fetchAPI(endpoint, options = {}) {
  return await apiClient.fetchAPI(endpoint, options);
}