class APIClient {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  async fetchAPI(endpoint, options = {}) {
    const cacheKey = endpoint;
    const { forceRefresh = false, timeout = 15000 } = options;

    // Check cache
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < 300000) {
        console.log(`[Cache] Hit for: ${endpoint}`);
        return data;
      }
    }

    // Check for pending request
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[Queue] Waiting for pending: ${endpoint}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Create new request
    const requestPromise = this.makeRequest(endpoint, timeout);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;
      if (data && !data.errors && !data.status_code) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      return { results: [] };
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async makeRequest(endpoint, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = window.buildUrl ? window.buildUrl(endpoint) : endpoint;
      console.log(`[API] Fetching: ${url}`);

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
        throw new Error(`TMDB Error: ${data.status_message}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
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

// Make available globally
window.fetchAPI = fetchAPI;
