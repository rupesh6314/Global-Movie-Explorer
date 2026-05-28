// Movie Comparison Tool
class MovieComparator {
    constructor() {
        this.selectedMovies = [];
        this.maxMovies = 3;
    }

    addMovie(movie) {
        if (this.selectedMovies.length >= this.maxMovies) {
            alert(`You can only compare up to ${this.maxMovies} movies`);
            return false;
        }

        if (this.selectedMovies.find(m => m.id === movie.id)) {
            alert('Movie already in comparison');
            return false;
        }

        this.selectedMovies.push(movie);
        this.updateComparisonBar();
        return true;
    }

    removeMovie(movieId) {
        this.selectedMovies = this.selectedMovies.filter(m => m.id !== movieId);
        this.updateComparisonBar();
    }

    updateComparisonBar() {
        let bar = document.getElementById('comparisonBar');
        if (!bar && this.selectedMovies.length > 0) {
            bar = document.createElement('div');
            bar.id = 'comparisonBar';
            bar.className = 'comparison-bar';
            document.body.appendChild(bar);
        }

        if (this.selectedMovies.length === 0) {
            if (bar) bar.remove();
            return;
        }

        bar.innerHTML = `
      <div class="comparison-bar-content">
        <div class="selected-movies">
          ${this.selectedMovies.map(movie => `
            <div class="selected-movie">
              <img src="https://image.tmdb.org/t/p/w92${movie.poster_path || movie.poster || ''}" alt="${movie.title}">
              <span>${movie.title}</span>
              <button onclick="event.stopPropagation(); movieComparator.removeMovie(${movie.id})">×</button>
            </div>
          `).join('')}
        </div>
        <button class="compare-btn" onclick="movieComparator.showComparison()">Compare (${this.selectedMovies.length})</button>
      </div>
    `;
    }

    async showComparison() {
        if (this.selectedMovies.length < 2) {
            alert('Select at least 2 movies to compare');
            return;
        }

        // Create a basic visual backdrop spinner during calculations
        const loadingIndicator = document.createElement('div');
        loadingIndicator.style = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); padding:20px; background:#000; color:#fff; border-radius:8px; z-index:2000;";
        loadingIndicator.textContent = "Fetching comparison details...";
        document.body.appendChild(loadingIndicator);

        try {
            // Fetch full structural details for each card index securely
            const movieDetails = await Promise.all(
                this.selectedMovies.map(movie => this.fetchMovieDetails(movie.id))
            );

            // Strip the loading screen away on network resolution success
            loadingIndicator.remove();

            const modal = document.createElement('div');
            modal.className = 'modal comparison-modal';
            modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:1500; overflow-y:auto;";
            
            modal.innerHTML = `
          <div class="modal-content comparison-content" style="background:#141414; padding:30px; border-radius:12px; width:90%; max-width:1000px; max-height:85vh; overflow-y:auto; position:relative; border:1px solid #333; color:#fff;">
            <span class="close-modal" style="position:absolute; top:15px; right:20px; font-size:30px; cursor:pointer; color:#aaa;">&times;</span>
            <h2 style="margin-top:0; color:#ffd700;">Movie Comparison</h2>
            <div class="comparison-table-wrapper" style="overflow-x:auto; margin-top:20px;">
              <table class="comparison-table" style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                  <tr style="border-bottom:2px solid #ffd700;">
                    <th style="padding:12px; color:#aaa;">Feature</th>
                    ${movieDetails.map(movie => `<th style="padding:12px; font-size:16px;">${movie.title || 'Unknown Title'}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Poster</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px;"><img src="${movie.poster_path ? 'https://image.tmdb.org/t/p/w185' + movie.poster_path : 'data:image/svg+xml,%3Csvg xmlns=\'http://w3.org\' width=\'100\' height=\'150\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23333\'/%3E%3C/svg%3E'}" style="width:100px; border-radius:6px; object-fit:cover;"></td>
                    `).join('')}
                  </tr>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Rating</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px; color:#ffaa00;">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'} <span style="font-size:11px; color:#777;">(${movie.vote_count?.toLocaleString() || 0} votes)</span></td>
                    `).join('')}
                  </tr>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Release Date</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px;">${movie.release_date ? new Date(movie.release_date).toLocaleDateString('en-US', {year:'numeric', month:'short'}) : 'N/A'}</td>
                    `).join('')}
                  </tr>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Runtime</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px;">${movie.runtime ? `${movie.runtime} min` : 'N/A'}</td>
                    `).join('')}
                  </tr>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Budget</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px; color:#63b3ed;">${movie.budget ? `$${movie.budget.toLocaleString()}` : 'N/A'}</td>
                    `).join('')}
                  </tr>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Revenue</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px; color:#48bb78;">${movie.revenue ? `$${movie.revenue.toLocaleString()}` : 'N/A'}</td>
                    `).join('')}
                  </tr>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Genres</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px; font-size:13px;">${movie.genres?.map(g => g.name).join(', ') || 'N/A'}</td>
                    `).join('')}
                  </tr>
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:12px; font-weight:bold; color:#aaa;">Popularity</td>
                    ${movieDetails.map(movie => `
                      <td style="padding:12px;">${movie.popularity ? Math.round(movie.popularity) : 'N/A'}</td>
                    `).join('')}
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                <button class="clear-compare" onclick="movieComparator.clearComparison()" style="background:#ff4444; color:#fff; border:none; padding:10px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Clear All</button>
            </div>
          </div>
        `;

            document.body.appendChild(modal);

            // Clean click dismiss triggers
            modal.querySelector('.close-modal').onclick = () => modal.remove();
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        } catch (err) {
            loadingIndicator.remove();
            console.error("Comparison execution crash:", err);
            alert("Could not pull content options from TMDB to build comparison metrics matrix.");
        }
    }

    async fetchMovieDetails(movieId) {
        try {
            // Safely route execution across the standard global wrapper layer built in api.js
            if (typeof fetchAPI === 'function') {
                return await fetchAPI(`/movie/${movieId}`);
            } else if (typeof apiClient !== 'undefined') {
                return await apiClient.fetchAPI(`/movie/${movieId}`);
            }
            throw new Error("No network transmission API method hook discovered in global workspace scope context.");
        } catch (error) {
            console.error('Error fetching movie details:', error);
            return {};
        }
    }

    clearComparison() {
        this.selectedMovies = [];
        this.updateComparisonBar();
        const modal = document.querySelector('.comparison-modal');
        if (modal) modal.remove();
    }
}

// Initialize comparator single-instance engine bound globally
const movieComparator = new MovieComparator();
