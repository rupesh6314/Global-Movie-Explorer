// api.js - Simple API client
class APIClient {
  constructor() {
    this.cache = new Map();
  }

  async fetchAPI(endpoint, options = {}) {
    const cacheKey = endpoint;
    const { forceRefresh = false } = options;
    
    // Check cache
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < 300000) {
        console.log(`[Cache] Hit: ${endpoint}`);
        return data;
      }
    }
    
    try {
      const url = window.buildUrl ? window.buildUrl(endpoint) : endpoint;
      console.log(`[API] Fetching: ${url}`);
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      return { results: [] };
    }
  }
}

const apiClient = new APIClient();

async function fetchAPI(endpoint, options = {}) {
  return await apiClient.fetchAPI(endpoint, options);
}

window.fetchAPI = fetchAPI;
