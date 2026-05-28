// api/tmdb.js - Simple serverless function
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_KEY;

// Handle all TMDB API requests
app.use(async (req, res) => {
  try {
    const endpoint = req.path;
    const queryParams = new URLSearchParams(req.query).toString();

    let cleanEndpoint = endpoint.replace(/\?+$/, '');
    if (!cleanEndpoint.startsWith('/')) {
      cleanEndpoint = '/' + cleanEndpoint;
    }

    const url = `${TMDB_BASE_URL}${cleanEndpoint}?api_key=${TMDB_KEY}${queryParams ? '&' + queryParams : ''}`;

    console.log(`[Proxy] Fetching: ${cleanEndpoint}`);

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MovieExplorer/2.0'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('API Proxy Error:', error.message);

    if (error.response) {
      res.status(error.response.status).json({
        error: 'TMDB API Error',
        details: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      res.status(503).json({
        error: 'TMDB API Unavailable',
        details: 'Could not connect to TMDB servers.'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        details: error.message
      });
    }
  }
});

module.exports = app;
