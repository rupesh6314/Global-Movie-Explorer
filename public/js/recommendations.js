// Movie Recommendation Engine - Language & Industry Based
class RecommendationEngine {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  // Get movie language and origin country
  async getMovieDetails(movieId) {
    try {
      const movie = await this.apiClient.fetchAPI(`/movie/${movieId}`);
      return {
        language: movie.original_language,
        originCountry: movie.production_countries?.[0]?.iso_3166_1 || 
                       (movie.original_language === 'hi' ? 'IN' : 
                        movie.original_language === 'te' ? 'IN' :
                        movie.original_language === 'ta' ? 'IN' :
                        movie.original_language === 'ml' ? 'IN' :
                        movie.original_language === 'kn' ? 'IN' : 'US'),
        title: movie.title,
        genres: movie.genres?.map(g => g.id) || []
      };
    } catch (error) {
      console.error('Error getting movie details:', error);
      return { language: 'en', originCountry: 'US', genres: [] };
    }
  }

  // Check if movie belongs to Indian cinema
  isIndianMovie(language, originCountry) {
    const indianLanguages = ['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or'];
    return indianLanguages.includes(language) || originCountry === 'IN';
  }

  // Get similar movies based on language and industry
  async getSimilarMovies(movieId) {
    try {
      // Get source movie details
      const sourceMovie = await this.getMovieDetails(movieId);
      const isIndian = this.isIndianMovie(sourceMovie.language, sourceMovie.originCountry);
      
      console.log(`Source Movie: ${sourceMovie.title}`);
      console.log(`Language: ${sourceMovie.language}, Origin: ${sourceMovie.originCountry}, Is Indian: ${isIndian}`);
      
      let similarMovies = [];
      
      // Get similar movies from TMDB
      const similar = await this.apiClient.fetchAPI(`/movie/${movieId}/similar`);
      
      if (similar.results && similar.results.length > 0) {
        // Fetch details for each similar movie to check language
        const movieDetailsPromises = similar.results.slice(0, 30).map(async (m) => {
          const details = await this.apiClient.fetchAPI(`/movie/${m.id}`);
          return {
            ...m,
            original_language: details.original_language,
            origin_country: details.production_countries?.[0]?.iso_3166_1,
            vote_average: m.vote_average,
            release_date: m.release_date,
            poster_path: m.poster_path,
            title: m.title,
            id: m.id
          };
        });
        
        const moviesWithDetails = await Promise.all(movieDetailsPromises);
        
        // Filter by language/industry
        if (isIndian) {
          // For Indian movies: show only Indian movies
          const indianLanguages = ['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr'];
          similarMovies = moviesWithDetails.filter(m => 
            indianLanguages.includes(m.original_language) || m.origin_country === 'IN'
          );
          console.log(`Filtered ${similarMovies.length} Indian movies from ${moviesWithDetails.length} total`);
        } else {
          // For Hollywood/English movies: show English movies
          similarMovies = moviesWithDetails.filter(m => 
            m.original_language === 'en' || m.origin_country === 'US'
          );
          console.log(`Filtered ${similarMovies.length} English movies from ${moviesWithDetails.length} total`);
        }
        
        // If no similar movies found, try genre-based discovery
        if (similarMovies.length === 0) {
          console.log('No similar movies found, trying genre-based discovery...');
          const discoverParams = new URLSearchParams();
          discoverParams.append('sort_by', 'popularity.desc');
          discoverParams.append('page', '1');
          
          if (isIndian) {
            discoverParams.append('with_origin_country', 'IN');
          } else {
            discoverParams.append('with_origin_country', 'US');
            discoverParams.append('with_original_language', 'en');
          }
          
          if (sourceMovie.genres.length > 0) {
            discoverParams.append('with_genres', sourceMovie.genres.slice(0, 3).join(','));
          }
          
          const discover = await this.apiClient.fetchAPI(`/discover/movie?${discoverParams.toString()}`);
          if (discover.results) {
            similarMovies = discover.results.filter(m => m.id !== movieId).slice(0, 12);
          }
        }
      }
      
      // Also get movies by director from same industry
      const credits = await this.apiClient.fetchAPI(`/movie/${movieId}/credits`);
      const director = credits.crew?.find(c => c.job === 'Director');
      
      if (director) {
        const directorCredits = await this.apiClient.fetchAPI(`/person/${director.id}/movie_credits`);
        let directorMovies = (directorCredits.cast || [])
          .filter(m => {
            if (isIndian) {
              const indianLanguages = ['hi', 'te', 'ta', 'ml', 'kn'];
              return indianLanguages.includes(m.original_language) && m.id !== movieId;
            } else {
              return m.original_language === 'en' && m.id !== movieId;
            }
          })
          .slice(0, 5);
        
        // Add director movies to similar list
        directorMovies.forEach(m => {
          if (!similarMovies.find(sm => sm.id === m.id)) {
            similarMovies.push(m);
          }
        });
      }
      
      // Sort by popularity and rating
      similarMovies.sort((a, b) => {
        const scoreA = (b.vote_average || 0) + (b.popularity || 0) / 100;
        const scoreB = (a.vote_average || 0) + (a.popularity || 0) / 100;
        return scoreA - scoreB;
      });
      
      console.log(`Final recommendations: ${similarMovies.length} movies`);
      return similarMovies.slice(0, 12);
      
    } catch (error) {
      console.error('Similar movies error:', error);
      return [];
    }
  }

  // Get recommendations for person based on their primary language
  async getPersonRecommendations(personId) {
    try {
      const person = await this.apiClient.fetchAPI(`/person/${personId}`);
      const credits = await this.apiClient.fetchAPI(`/person/${personId}/movie_credits`);
      
      // Determine person's primary language based on their most frequent movie language
      const languageCount = {};
      const movies = credits.cast || [];
      
      for (const movie of movies.slice(0, 20)) {
        const details = await this.apiClient.fetchAPI(`/movie/${movie.id}`);
        const lang = details.original_language;
        if (lang) {
          languageCount[lang] = (languageCount[lang] || 0) + 1;
        }
      }
      
      let primaryLanguage = 'en';
      let maxCount = 0;
      for (const [lang, count] of Object.entries(languageCount)) {
        if (count > maxCount) {
          maxCount = count;
          primaryLanguage = lang;
        }
      }
      
      const isIndian = this.isIndianMovie(primaryLanguage, primaryLanguage === 'hi' ? 'IN' : '');
      
      console.log(`Person ${person.name} primary language: ${primaryLanguage}, Is Indian: ${isIndian}`);
      
      // Get popular movies from same industry
      const params = new URLSearchParams();
      params.append('sort_by', 'popularity.desc');
      params.append('page', '1');
      
      if (isIndian) {
        params.append('with_origin_country', 'IN');
      } else {
        params.append('with_origin_country', 'US');
        params.append('with_original_language', 'en');
      }
      
      const discover = await this.apiClient.fetchAPI(`/discover/movie?${params.toString()}`);
      return discover.results?.slice(0, 12) || [];
      
    } catch (error) {
      console.error('Person recommendations error:', error);
      return [];
    }
  }

  renderRecommendations(movies, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!movies || movies.length === 0) {
      container.innerHTML = '<p class="no-recommendations">No recommendations available in this language/industry</p>';
      return;
    }
    
    container.innerHTML = `
      <div class="recommendations-grid">
        ${movies.map(movie => `
          <div class="rec-card" onclick="location.href='details.html?movieId=${movie.id}'">
            <img src="https://image.tmdb.org/t/p/w200${movie.poster_path}" alt="${movie.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'300\' viewBox=\'0 0 200 300\'%3E%3Crect width=\'200\' height=\'300\' fill=\'%23333\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23666\' font-size=\'16\' dy=\'.3em\'%3E🎬%3C/text%3E%3C/svg%3E'">
            <div class="rec-info">
              <h4>${movie.title}</h4>
              <p>⭐ ${movie.vote_average?.toFixed(1) || 'N/A'}</p>
              <p class="rec-language-badge">${movie.original_language?.toUpperCase() || 'N/A'}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Initialize recommendation engine
const recEngine = new RecommendationEngine(apiClient);