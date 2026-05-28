const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_KEY;

console.log('TMDB_KEY configured:', !!TMDB_KEY);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', apiKeyConfigured: !!TMDB_KEY });
});

// Main proxy - THIS IS THE IMPORTANT PART
app.all('/*', async (req, res) => {
  try {
    const endpoint = req.path;
    const queryParams = new URLSearchParams(req.query).toString();
    
    let cleanEndpoint = endpoint;
    if (!cleanEndpoint.startsWith('/')) {
      cleanEndpoint = '/' + cleanEndpoint;
    }
    
    const url = `${TMDB_BASE_URL}${cleanEndpoint}?api_key=${TMDB_KEY}${queryParams ? '&' + queryParams : ''}`;
    
    console.log(`[Proxy] Fetching: ${cleanEndpoint}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'Accept': 'application/json' }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = app;
