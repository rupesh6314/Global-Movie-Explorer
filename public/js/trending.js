// Trending Movies and Actors Widget
class TrendingWidget {
    constructor(apiClient) {
        this.apiClient = apiClient;
    }

    async loadTrendingMovies() {
        try {
            const trending = await this.apiClient.fetchAPI('/trending/movie/week?');
            return trending.results?.slice(0, 10) || [];
        } catch (error) {
            console.error('Error loading trending movies:', error);
            return [];
        }
    }

    async loadTrendingActors() {
        try {
            const trending = await this.apiClient.fetchAPI('/trending/person/week?');
            return trending.results?.slice(0, 10) || [];
        } catch (error) {
            console.error('Error loading trending actors:', error);
            return []; // Return empty array instead of throwing
        }
    }

    async loadUpcomingMovies() {
        try {
            const upcoming = await this.apiClient.fetchAPI('/movie/upcoming?');
            return upcoming.results?.slice(0, 10) || [];
        } catch (error) {
            console.error('Error loading upcoming movies:', error);
            return [];
        }
    }

    async loadNowPlaying() {
        try {
            const nowPlaying = await this.apiClient.fetchAPI('/movie/now_playing?');
            return nowPlaying.results?.slice(0, 10) || [];
        } catch (error) {
            console.error('Error loading now playing:', error);
            return [];
        }
    }

    async loadTrendingContent(type) {
        const contentDiv = document.getElementById('trendingContent');
        if (!contentDiv) return;

        let items = [];
        try {
            switch (type) {
                case 'movies':
                    items = await this.loadTrendingMovies();
                    break;
                case 'actors':
                    items = await this.loadTrendingActors();
                    break;
                case 'upcoming':
                    items = await this.loadUpcomingMovies();
                    break;
                default:
                    items = await this.loadTrendingMovies();
            }
        } catch (error) {
            console.error('Error loading trending content:', error);
            items = [];
        }

        if (!items || items.length === 0) {
            contentDiv.innerHTML = '<p style="text-align:center;padding:20px;">No trending content available<br><small>Check your API connection</small></p>';
            return;
        }

        contentDiv.innerHTML = `
      <div class="trending-list">
        ${items.map((item, index) => `
          <div class="trending-item" onclick="location.href='${item.title ? `details.html?movieId=${item.id}` : `details.html?personId=${item.id}`}'">
            <div class="trend-rank">${index + 1}</div>
            ${item.poster_path || item.profile_path ?
                `<img src="https://image.tmdb.org/t/p/w92${item.poster_path || item.profile_path}" alt="${item.title || item.name}">` :
                `<div style="width:40px;height:60px;background:#333;border-radius:5px;display:flex;align-items:center;justify-content:center;">🎬</div>`
            }
            <div class="trend-info">
              <div class="trend-title">${item.title || item.name || 'Unknown'}</div>
              <div class="trend-score">${item.vote_average ? `⭐ ${item.vote_average.toFixed(1)}` : '⭐ Popular'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    }

    renderTrendingSidebar() {
        // Check if sidebar already exists
        if (document.querySelector('.trending-sidebar')) return;

        const sidebar = document.createElement('div');
        sidebar.className = 'trending-sidebar';
        sidebar.innerHTML = `
      <div class="trending-header">
        <h3>🔥 Trending This Week</h3>
        <div class="trending-tabs">
          <button class="trend-tab active" data-type="movies">Movies</button>
          <button class="trend-tab" data-type="actors">Actors</button>
          <button class="trend-tab" data-type="upcoming">Upcoming</button>
        </div>
      </div>
      <div id="trendingContent" class="trending-content">
        <div class="loading-spinner">Loading...</div>
      </div>
    `;

        document.body.appendChild(sidebar);
        this.setupTrendingEvents(sidebar);
        this.loadTrendingContent('movies');

        return sidebar;
    }

    setupTrendingEvents(sidebar) {
        const tabs = sidebar.querySelectorAll('.trend-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadTrendingContent(tab.dataset.type);
            };
        });
    }
}

// Initialize trending widget only if API is working
let trendingWidget;
document.addEventListener('DOMContentLoaded', () => {
    if (typeof apiClient !== 'undefined') {
        trendingWidget = new TrendingWidget(apiClient);
        // Don't auto-render - let index.html handle it
    }
});