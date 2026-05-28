document.addEventListener("DOMContentLoaded", () => {

  const params = new URLSearchParams(location.search);
  const movieId = params.get("movieId");
  const personId = params.get("personId");

  const container = document.getElementById("details");
  if (!container) return;

  /* =====================================
     HELPERS
  ===================================== */

  function getImage(path, size = "w500") {
    if (!path) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'%3E%3Crect width='500' height='750' fill='%231a1a2e'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23666' font-size='30' dy='.3em'%3E🎬%3C/text%3E%3C/svg%3E";
    }
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  function formatCurrency(amount) {
    if (!amount || amount === 0) return 'N/A';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  }

  function formatRuntime(minutes) {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  /**
   * Returns accurate rating display.
   * Requires minimum 10 votes — same threshold TMDB uses internally.
   * Returns an object: { ratingText, voteText }
   */
  function getRatingDisplay(voteAverage, voteCount) {
    if (
      !voteAverage ||
      voteAverage === 0 ||
      !voteCount ||
      voteCount < 10
    ) {
      return {
        ratingText: 'N/A',
        voteText: voteCount ? `Only ${voteCount} vote${voteCount > 1 ? 's' : ''} — not enough data` : 'No ratings yet'
      };
    }

    const formattedVotes = voteCount >= 1000
      ? `${(voteCount / 1000).toFixed(1)}k votes`
      : `${voteCount.toLocaleString()} votes`;

    return {
      ratingText: `${voteAverage.toFixed(1)} / 10`,
      voteText: formattedVotes
    };
  }

  async function getTrailer(movieId) {
    try {
      const data = await fetchAPI(`/movie/${movieId}/videos`);
      if (!data.results || data.results.length === 0) return null;
      const trailer = data.results.find(v => v.type === "Trailer" && v.site === "YouTube");
      return trailer ? `https://www.youtube.com/embed/${trailer.key}?autoplay=0` : null;
    } catch (error) {
      console.error('Error fetching trailer:', error);
      return null;
    }
  }

  function escapeString(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  /* =====================================
     WINDOW-SCOPED NAVIGATION
  ===================================== */

  window.goToPerson = (personId, personName) => {
    if (personId && personId > 0) {
      window.location.href = `details.html?personId=${personId}`;
    }
  };

  window.goToMovie = (movieId, movieTitle) => {
    if (movieId && movieId > 0) {
      window.location.href = `details.html?movieId=${movieId}`;
    }
  };

  window.openTrailerModal = (url) => {
    let modal = document.getElementById('trailerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'trailerModal';
      modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10000;cursor:pointer;";
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div style="position:relative;width:80%;max-width:1000px;aspect-ratio:16/9;">
        <button style="position:absolute;top:-40px;right:0;background:none;border:none;color:white;font-size:30px;cursor:pointer;" onclick="document.getElementById('trailerModal').remove()">✕</button>
        <iframe width="100%" height="100%" src="${url}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:15px;"></iframe>
      </div>
    `;
  };

  window.toggleOTTPlatforms = function () {
    const platformsList = document.getElementById('ottPlatformsList');
    if (platformsList) platformsList.classList.toggle('expanded');
  };

  /* =====================================
     RENDER RECOMMENDATIONS
  ===================================== */

  function renderRecommendations(movies, containerElement) {
    if (!movies || movies.length === 0) {
      containerElement.innerHTML = '<p class="no-recommendations">No recommendations available</p>';
      return;
    }

    containerElement.innerHTML = '';

    movies.forEach(movie => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.onclick = () => window.location.href = `details.html?movieId=${movie.id}`;

      const posterUrl = movie.poster_path
        ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
        : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23666' font-size='16' dy='.3em'%3E🎬%3C/text%3E%3C/svg%3E";

      const { ratingText, voteText } = getRatingDisplay(movie.vote_average, movie.vote_count);
      const ratingDisplay = ratingText === 'N/A'
        ? '<span style="color:#888;font-size:12px;">Not enough ratings</span>'
        : `<span>⭐ ${ratingText}</span><span style="color:#888;font-size:11px;margin-left:4px;">${voteText}</span>`;

      card.innerHTML = `
        <img src="${posterUrl}" alt="${movie.title}">
        <div class="rec-info">
          <h4>${movie.title}</h4>
          <p>${ratingDisplay}</p>
          ${movie.original_language ? `<span class="rec-language-badge">${movie.original_language.toUpperCase()}</span>` : ''}
        </div>
      `;

      containerElement.appendChild(card);
    });
  }

  /* =====================================
     LOAD MOVIE DETAILS
  ===================================== */

  async function loadMovie() {
    try {
      container.innerHTML = '<div class="loading-screen"><div class="loading-spinner-large"></div><p>Loading movie details...</p></div>';

      const movie = await fetchAPI(`/movie/${movieId}`);

      if (!movie || !movie.id) {
        container.innerHTML = '<div class="error-state"><h2>❌ Movie not found</h2><button onclick="window.location.href=\'index.html\'">Go Back</button></div>';
        return;
      }

      if (typeof analytics !== 'undefined') {
        analytics.trackMovieView(movieId, movie.title);
      }

      const credits = await fetchAPI(`/movie/${movieId}/credits`);
      const providers = await fetchAPI(`/movie/${movieId}/watch/providers`);
      const trailerUrl = await getTrailer(movieId);

      let similarMovies = [];
      if (typeof recEngine !== 'undefined') {
        try {
          similarMovies = await recEngine.getSimilarMovies(movieId);
        } catch (e) {
          console.error('Error getting recommendations:', e);
        }
      }

      const director = credits.crew?.find(c => c.job === "Director")?.name || "N/A";
      const topCast = credits.cast?.slice(0, 8) || [];
      const writers = credits.crew
        ?.filter(c => c.job === "Writer" || c.department === "Writing")
        .slice(0, 3).map(c => c.name).join(", ") || "N/A";
      const productionCompanies = movie.production_companies?.slice(0, 3).map(c => c.name).join(", ") || "N/A";

      // ✅ Accurate rating with minimum vote threshold
      const { ratingText, voteText } = getRatingDisplay(movie.vote_average, movie.vote_count);

      // OTT Providers
      let ottHTML = '<div class="ott-placeholder">Loading streaming options...</div>';

      if (providers.results) {
        let availableProviders = providers.results.IN?.flatrate || providers.results.US?.flatrate || [];

        if (availableProviders.length > 0) {
          const ottLinksMap = {
            'Netflix': `https://www.netflix.com/search?q=${encodeURIComponent(movie.title)}`,
            'Amazon Prime Video': `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(movie.title)}`,
            'Disney+': `https://www.hotstar.com/in/search?q=${encodeURIComponent(movie.title)}`,
            'Hotstar': `https://www.hotstar.com/in/search?q=${encodeURIComponent(movie.title)}`,
            'ZEE5': `https://www.zee5.com/search?q=${encodeURIComponent(movie.title)}`,
            'Sony LIV': `https://www.sonyliv.com/search/${encodeURIComponent(movie.title)}`,
            'Apple TV+': `https://tv.apple.com/search?term=${encodeURIComponent(movie.title)}`,
            'HBO Max': `https://www.max.com/search?q=${encodeURIComponent(movie.title)}`,
            'JioCinema': `https://www.jiocinema.com/search?q=${encodeURIComponent(movie.title)}`,
            'Voot': `https://www.voot.com/search/${encodeURIComponent(movie.title)}`,
            'MX Player': `https://www.mxplayer.in/search?q=${encodeURIComponent(movie.title)}`,
            'YouTube': `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' full movie')}`,
            'Google Play': `https://play.google.com/store/search?q=${encodeURIComponent(movie.title)}&c=movies`
          };

          ottHTML = `
            <div class="ott-links-container">
              <div class="ott-header">
                <span>📺 Available on:</span>
                <button class="ott-toggle" onclick="toggleOTTPlatforms()">Show all</button>
              </div>
              <div class="ott-platforms-list" id="ottPlatformsList">
                ${availableProviders.map(provider => {
                  const providerName = provider.provider_name;
                  const logoUrl = `https://image.tmdb.org/t/p/w92${provider.logo_path}`;
                  const directUrl = ottLinksMap[providerName] || `https://www.google.com/search?q=${encodeURIComponent(providerName + ' ' + movie.title + ' watch online')}`;
                  return `
                    <a href="${directUrl}" target="_blank" class="ott-platform-link" data-provider="${providerName}">
                      <img src="${logoUrl}" alt="${providerName}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Crect width=\'40\' height=\'40\' fill=\'%23333\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23666\' font-size=\'12\' dy=\'.3em\'%3E${providerName.charAt(0)}%3C/text%3E%3C/svg%3E'">
                      <span>${providerName}</span>
                    </a>
                  `;
                }).join('')}
              </div>
              <div class="ott-search-alternative">
                <a href="https://www.justwatch.com/in/search?q=${encodeURIComponent(movie.title)}" target="_blank" class="justwatch-link">
                  🔍 Compare prices on JustWatch
                </a>
              </div>
            </div>
          `;
        } else {
          ottHTML = `
            <div class="ott-not-available">
              <p>📺 Not available on major streaming platforms in India yet</p>
              <div class="ott-alternatives">
                <a href="https://www.justwatch.com/in/search?q=${encodeURIComponent(movie.title)}" target="_blank" class="ott-alternative-link">🔍 Search on JustWatch</a>
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' full movie')}" target="_blank" class="ott-alternative-link">▶️ Search on YouTube</a>
                <a href="https://www.google.com/search?q=${encodeURIComponent(movie.title + ' watch online')}" target="_blank" class="ott-alternative-link">🌐 Google Search</a>
              </div>
            </div>
          `;
        }
      }

      container.innerHTML = `
        <div class="movie-hero" style="background-image: linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('${getImage(movie.backdrop_path, 'original')}')">
          <div class="hero-content">
            <div class="movie-poster-large">
              <img src="${getImage(movie.poster_path, 'w500')}" alt="${movie.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'500\' height=\'750\' viewBox=\'0 0 500 750\'%3E%3Crect width=\'500\' height=\'750\' fill=\'%23333\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23666\' font-size=\'30\' dy=\'.3em\'%3E🎬%3C/text%3E%3C/svg%3E'">
              <div class="action-buttons">
                <button class="action-btn-watchlist" onclick="if(typeof movieUser !== 'undefined') movieUser.addToWatchlist({id: ${movie.id}, title: '${escapeString(movie.title)}', poster_path: '${movie.poster_path || ''}'})">
                  📝 Watchlist
                </button>
                <button class="action-btn-favorite" onclick="if(typeof movieUser !== 'undefined') movieUser.addToFavorites({id: ${movie.id}, title: '${escapeString(movie.title)}', poster_path: '${movie.poster_path || ''}'})">
                  ❤️ Favorite
                </button>
                <button class="action-btn-compare" onclick="if(typeof movieComparator !== 'undefined') movieComparator.addMovie({id: ${movie.id}, title: '${escapeString(movie.title)}', poster_path: '${movie.poster_path || ''}'})">
                  🔍 Compare
                </button>
              </div>
            </div>

            <div class="movie-info-hero">
              <h1 class="movie-title">${movie.title}</h1>
              <div class="movie-tagline">${movie.tagline || ''}</div>

              <div class="movie-stats">
                <div class="stat">
                  <span class="stat-label">⭐ Rating</span>
                  <span class="stat-value">${ratingText}</span>
                  <span class="stat-note">${voteText}</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat">
                  <span class="stat-label">📅 Release</span>
                  <span class="stat-value">${movie.release_date
                    ? new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'N/A'}</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat">
                  <span class="stat-label">⏱️ Runtime</span>
                  <span class="stat-value">${formatRuntime(movie.runtime)}</span>
                </div>
              </div>

              <div class="movie-genres-list">
                ${movie.genres?.map(g => `<span class="genre-badge">${g.name}</span>`).join('') || ''}
              </div>

              ${trailerUrl ? `
                <button class="trailer-btn" onclick="openTrailerModal('${trailerUrl}')">
                  ▶ Watch Trailer
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="movie-content">
          <div class="content-grid">
            <div class="content-main">
              <div class="info-card">
                <h3>📖 Synopsis</h3>
                <p class="overview-text">${movie.overview || "No description available."}</p>
              </div>

              <div class="info-card">
                <h3>🎬 Cast & Crew</h3>
                <div class="crew-info">
                  <div class="crew-item"><strong>Director:</strong> ${director}</div>
                  <div class="crew-item"><strong>Writer:</strong> ${writers}</div>
                </div>

                <div class="cast-grid">
                  <h4>Starring</h4>
                  <div class="cast-list">
                    ${topCast.map(actor => `
                      <div class="cast-card" onclick="goToPerson(${actor.id}, '${escapeString(actor.name)}')">
                        <img src="${getImage(actor.profile_path, 'w185')}" alt="${actor.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'185\' height=\'278\' viewBox=\'0 0 185 278\'%3E%3Crect width=\'185\' height=\'278\' fill=\'%23333\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23666\' font-size=\'14\' dy=\'.3em\'%3E🎭%3C/text%3E%3C/svg%3E'">
                        <div class="cast-name">${actor.name}</div>
                        <div class="cast-character">${actor.character || ''}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <div class="content-sidebar">
              <div class="info-card ott-card">
                <h3>📺 Where to Watch</h3>
                ${ottHTML}
              </div>

              <div class="info-card">
                <h3>💰 Box Office</h3>
                <div class="box-office-stats">
                  <div class="box-item">
                    <span class="box-label">Budget</span>
                    <span class="box-value">${formatCurrency(movie.budget)}</span>
                  </div>
                  <div class="box-item">
                    <span class="box-label">Revenue</span>
                    <span class="box-value">${formatCurrency(movie.revenue)}</span>
                  </div>
                  ${movie.budget && movie.revenue && movie.revenue > movie.budget ? `
                    <div class="box-item profit">
                      <span class="box-label">Profit</span>
                      <span class="box-value profit-value">${formatCurrency(movie.revenue - movie.budget)}</span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="info-card">
                <h3>ℹ️ Additional Info</h3>
                <div class="info-list">
                  <div class="info-item">
                    <span class="info-label">Original Language</span>
                    <span class="info-value">${movie.original_language?.toUpperCase() || 'N/A'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Popularity</span>
                    <span class="info-value">${Math.round(movie.popularity || 0)}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Status</span>
                    <span class="info-value">${movie.status || 'N/A'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Production</span>
                    <span class="info-value">${productionCompanies}</span>
                  </div>
                  ${movie.homepage ? `
                    <div class="info-item">
                      <span class="info-label">Website</span>
                      <span class="info-value"><a href="${movie.homepage}" target="_blank">Visit Official Site →</a></span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="info-card">
                <h3>🔗 Quick Links</h3>
                <div class="quick-links">
                  ${trailerUrl ? `<a href="${trailerUrl}" target="_blank" class="quick-link">🎥 Watch Trailer</a>` : ''}
                  <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' full movie')}" target="_blank" class="quick-link">🔍 Search Full Movie</a>
                  <a href="https://www.imdb.com/find?q=${encodeURIComponent(movie.title)}" target="_blank" class="quick-link">📽️ View on IMDb</a>
                  <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(movie.title.replace(/ /g, '_'))}" target="_blank" class="quick-link">📚 Wikipedia</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Recommendations section
      if (similarMovies && similarMovies.length > 0) {
        let recSection = document.getElementById('recommendationsSection');
        let recContainer = document.getElementById('recommendationsContainer');

        if (!recSection) {
          recSection = document.createElement('div');
          recSection.id = 'recommendationsSection';
          recSection.className = 'recommendations-section';
          recSection.innerHTML = `
            <div class="section-header">
              <h2>🍿 You Might Also Like</h2>
              <div class="section-line"></div>
            </div>
            <div id="recommendationsContainer" class="recommendations-grid"></div>
          `;
          container.appendChild(recSection);
          recContainer = document.getElementById('recommendationsContainer');
        }

        if (recContainer) {
          recSection.style.display = 'block';
          renderRecommendations(similarMovies, recContainer);
        }
      }

    } catch (error) {
      console.error('Error loading movie:', error);
      container.innerHTML = `<div class="error-state"><h2>❌ Error Loading Movie</h2><p>${error.message}</p><button onclick="window.location.href='index.html'">Go Back</button></div>`;
    }
  }

  /* =====================================
     LOAD PERSON DETAILS
  ===================================== */

  async function loadPerson() {
    try {
      container.innerHTML = '<div class="loading-screen"><div class="loading-spinner-large"></div><p>Loading person details...</p></div>';

      const person = await fetchAPI(`/person/${personId}`);
      const castCredits = await fetchAPI(`/person/${personId}/movie_credits`);

      console.log(`Loading person: ${person.name}`);
      console.log(`Cast movies found: ${castCredits.cast?.length || 0}`);
      console.log(`Crew movies found: ${castCredits.crew?.length || 0}`);

      if (!person || !person.id) {
        container.innerHTML = '<div class="error-state"><h2>❌ Person not found</h2><button onclick="window.location.href=\'index.html\'">Go Back</button></div>';
        return;
      }

      const allCastMovies = castCredits.cast || [];
      const allCrewMovies = castCredits.crew || [];

      const allMoviesMap = new Map();

      allCastMovies.forEach(movie => {
        if (!allMoviesMap.has(movie.id)) {
          allMoviesMap.set(movie.id, {
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            popularity: movie.popularity,
            character: movie.character || null,
            job: null,
            department: 'Acting',
            role: movie.character ? `🎭 ${movie.character}` : 'Actor'
          });
        }
      });

      allCrewMovies.forEach(movie => {
        if (allMoviesMap.has(movie.id)) {
          const existing = allMoviesMap.get(movie.id);
          if (movie.job) {
            existing.job = existing.job ? `${existing.job}, ${movie.job}` : movie.job;
            existing.department = 'Acting & Crew';
            existing.role = `${existing.role} | 🎥 ${movie.job}`;
          }
        } else {
          allMoviesMap.set(movie.id, {
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            popularity: movie.popularity,
            character: null,
            job: movie.job,
            department: movie.department || 'Crew',
            role: `🎥 ${movie.job || movie.department || 'Crew'}`
          });
        }
      });

      let allMovies = Array.from(allMoviesMap.values());

      allMovies.sort((a, b) => {
        const dateA = a.release_date ? new Date(a.release_date) : new Date(0);
        const dateB = b.release_date ? new Date(b.release_date) : new Date(0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (b.popularity || 0) - (a.popularity || 0);
      });

      const moviesWithPosters = allMovies.filter(m => m.poster_path);
      const moviesWithoutPosters = allMovies.filter(m => !m.poster_path);

      console.log(`Total unique movies: ${allMovies.length}`);
      console.log(`With posters: ${moviesWithPosters.length}`);
      console.log(`Without posters: ${moviesWithoutPosters.length}`);

      const actingMovies = allMovies.filter(m => m.department === 'Acting');
      const directingMovies = allMovies.filter(m => m.job === 'Director');
      const producingMovies = allMovies.filter(m => m.job === 'Producer' || m.job === 'Executive Producer');
      const writingMovies = allMovies.filter(m => m.job === 'Writer' || m.department === 'Writing');
      const otherCrewMovies = allMovies.filter(m =>
        m.department !== 'Acting' &&
        m.job !== 'Director' &&
        m.job !== 'Producer' &&
        m.job !== 'Executive Producer' &&
        m.job !== 'Writer' &&
        m.department !== 'Writing'
      );

      container.innerHTML = `
        <div class="person-hero">
          <div class="person-profile">
            <img src="${getImage(person.profile_path, 'w400')}" alt="${person.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'600\' viewBox=\'0 0 400 600\'%3E%3Crect width=\'400\' height=\'600\' fill=\'%23333\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23666\' font-size=\'30\' dy=\'.3em\'%3E🎭%3C/text%3E%3C/svg%3E'">
          </div>
          <div class="person-info">
            <h1>${person.name}</h1>
            <div class="person-badges">
              <span class="person-badge">🎬 Total Movies: ${allMovies.length}</span>
              <span class="person-badge">🎭 Acting: ${actingMovies.length}</span>
              <span class="person-badge">🎥 Crew: ${allCrewMovies.length}</span>
            </div>
            ${person.birthday ? `<div class="person-detail">🎂 Born: ${new Date(person.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} ${person.deathday ? `(Died: ${new Date(person.deathday).toLocaleDateString()})` : ''}</div>` : ''}
            ${person.place_of_birth ? `<div class="person-detail">📍 Born in: ${person.place_of_birth}</div>` : ''}
            ${person.known_for_department ? `<div class="person-detail">🎭 Known for: ${person.known_for_department}</div>` : ''}
            <div class="person-bio">
              <h3>Biography</h3>
              <p>${person.biography || "No biography available."}</p>
            </div>
          </div>
        </div>

        <div class="filmography-section">
          <div class="filmography-header">
            <h2>🎬 Complete Filmography</h2>
            <div class="filmography-stats">
              <span>📊 Showing ${moviesWithPosters.length} of ${allMovies.length} total movies</span>
              ${moviesWithoutPosters.length > 0 ? `<span class="note">(${moviesWithoutPosters.length} movies without posters not shown)</span>` : ''}
            </div>
          </div>

          <div class="filmography-tabs">
            <button class="film-tab active" data-tab="all">🎬 All (${moviesWithPosters.length})</button>
            ${actingMovies.length > 0 ? `<button class="film-tab" data-tab="acting">🎭 Acting (${actingMovies.filter(m => m.poster_path).length})</button>` : ''}
            ${directingMovies.length > 0 ? `<button class="film-tab" data-tab="directing">🎥 Directing (${directingMovies.filter(m => m.poster_path).length})</button>` : ''}
            ${producingMovies.length > 0 ? `<button class="film-tab" data-tab="producing">📦 Producing (${producingMovies.filter(m => m.poster_path).length})</button>` : ''}
            ${writingMovies.length > 0 ? `<button class="film-tab" data-tab="writing">✍️ Writing (${writingMovies.filter(m => m.poster_path).length})</button>` : ''}
            ${otherCrewMovies.length > 0 ? `<button class="film-tab" data-tab="other">🎨 Other Crew (${otherCrewMovies.filter(m => m.poster_path).length})</button>` : ''}
          </div>

          <div id="allMoviesTab" class="film-tab-content active">
            <div class="filmography-grid" id="filmographyAll"></div>
          </div>
          ${actingMovies.length > 0 ? `<div id="actingMoviesTab" class="film-tab-content"><div class="filmography-grid" id="filmographyActing"></div></div>` : ''}
          ${directingMovies.length > 0 ? `<div id="directingMoviesTab" class="film-tab-content"><div class="filmography-grid" id="filmographyDirecting"></div></div>` : ''}
          ${producingMovies.length > 0 ? `<div id="producingMoviesTab" class="film-tab-content"><div class="filmography-grid" id="filmographyProducing"></div></div>` : ''}
          ${writingMovies.length > 0 ? `<div id="writingMoviesTab" class="film-tab-content"><div class="filmography-grid" id="filmographyWriting"></div></div>` : ''}
          ${otherCrewMovies.length > 0 ? `<div id="otherMoviesTab" class="film-tab-content"><div class="filmography-grid" id="filmographyOther"></div></div>` : ''}
        </div>
      `;

      // ✅ Film card with accurate rating
      function createFilmCard(movie) {
        const card = document.createElement("div");
        card.className = "film-card";

        const posterUrl = movie.poster_path
          ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
          : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23666' font-size='16' dy='.3em'%3E🎬%3C/text%3E%3C/svg%3E";

        let roleText = '';
        if (movie.character) {
          roleText = `<p class="film-role">🎭 ${movie.character.length > 30 ? movie.character.substring(0, 30) + '...' : movie.character}</p>`;
        } else if (movie.job) {
          roleText = `<p class="film-role">🎥 ${movie.job.length > 30 ? movie.job.substring(0, 30) + '...' : movie.job}</p>`;
        }

        // ✅ Only show rating if vote_count >= 10
        const { ratingText } = getRatingDisplay(movie.vote_average, movie.vote_count);
        const ratingHTML = ratingText !== 'N/A'
          ? `<p class="film-rating">⭐ ${ratingText}</p>`
          : '';

        card.innerHTML = `
          <img src="${posterUrl}" alt="${movie.title}" loading="lazy">
          <div class="film-info">
            <h4>${movie.title || 'Unknown'}</h4>
            <p class="film-year">${movie.release_date?.slice(0, 4) || 'N/A'}</p>
            ${roleText}
            ${ratingHTML}
          </div>
        `;

        card.onclick = () => window.location.href = `details.html?movieId=${movie.id}`;
        return card;
      }

      // Populate tabs
      const allGrid = document.getElementById("filmographyAll");
      moviesWithPosters.forEach(movie => allGrid.appendChild(createFilmCard(movie)));

      if (actingMovies.length > 0) {
        const g = document.getElementById("filmographyActing");
        actingMovies.filter(m => m.poster_path).forEach(movie => g.appendChild(createFilmCard(movie)));
      }
      if (directingMovies.length > 0) {
        const g = document.getElementById("filmographyDirecting");
        directingMovies.filter(m => m.poster_path).forEach(movie => g.appendChild(createFilmCard(movie)));
      }
      if (producingMovies.length > 0) {
        const g = document.getElementById("filmographyProducing");
        producingMovies.filter(m => m.poster_path).forEach(movie => g.appendChild(createFilmCard(movie)));
      }
      if (writingMovies.length > 0) {
        const g = document.getElementById("filmographyWriting");
        writingMovies.filter(m => m.poster_path).forEach(movie => g.appendChild(createFilmCard(movie)));
      }
      if (otherCrewMovies.length > 0) {
        const g = document.getElementById("filmographyOther");
        otherCrewMovies.filter(m => m.poster_path).forEach(movie => g.appendChild(createFilmCard(movie)));
      }

      if (moviesWithPosters.length === 0) {
        allGrid.innerHTML = '<p class="no-results">No movies with posters available for this person</p>';
      }

      // Tab switching
      const tabs = document.querySelectorAll('.film-tab');
      tabs.forEach(tab => {
        tab.onclick = () => {
          tabs.forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.film-tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          const contentEl = document.getElementById(`${tab.dataset.tab}MoviesTab`);
          if (contentEl) contentEl.classList.add('active');
        };
      });

    } catch (error) {
      console.error('Error loading person:', error);
      container.innerHTML = `<div class="error-state"><h2>❌ Error Loading Person</h2><p>${error.message}</p><button onclick="window.location.href='index.html'">Go Back</button></div>`;
    }
  }

  /* =====================================
     ROUTER
  ===================================== */

  if (movieId) {
    loadMovie();
  } else if (personId) {
    loadPerson();
  } else {
    container.innerHTML = '<div class="error-state"><h2>⚠️ No data provided</h2><button onclick="window.location.href=\'index.html\'">Go to Home</button></div>';
  }

});