// User Analytics and Tracking
class AnalyticsTracker {
    constructor() {
        this.events = this.loadEvents();
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
    }

    generateSessionId() {
        let sessionId = localStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    loadEvents() {
        const events = localStorage.getItem('analytics_events');
        return events ? JSON.parse(events) : [];
    }

    saveEvents() {
        // Keep only last 100 events
        const eventsToKeep = this.events.slice(-100);
        localStorage.setItem('analytics_events', JSON.stringify(eventsToKeep));
    }

    trackEvent(category, action, label = null, value = null) {
        const event = {
            category,
            action,
            label,
            value,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        this.events.push(event);
        this.saveEvents();

        // Also log to console in development
        if (window.location.hostname === 'localhost') {
            console.log('[Analytics]', event);
        }
    }

    trackMovieView(movieId, movieTitle) {
        this.trackEvent('Movie', 'view', movieTitle, movieId);

        // Track movie views for popularity
        const views = JSON.parse(localStorage.getItem('movie_views')) || {};
        views[movieId] = (views[movieId] || 0) + 1;
        localStorage.setItem('movie_views', JSON.stringify(views));
    }

    trackSearch(query, resultsCount) {
        this.trackEvent('Search', 'query', query, resultsCount);
    }

    trackFilter(filterName, filterValue) {
        this.trackEvent('Filter', filterName, filterValue);
    }

    getPopularMovies(limit = 10) {
        const views = JSON.parse(localStorage.getItem('movie_views')) || {};
        return Object.entries(views)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id, count]) => ({ id: parseInt(id), views: count }));
    }

    getUserStats() {
        const totalSessions = JSON.parse(localStorage.getItem('total_sessions') || '0');
        const totalMovieViews = Object.values(JSON.parse(localStorage.getItem('movie_views') || '{}')).reduce((a, b) => a + b, 0);

        return {
            totalSessions: ++totalSessions,
            totalMovieViews,
            sessionDuration: Math.floor((Date.now() - this.startTime) / 1000),
            eventsTracked: this.events.length
        };
    }

    renderDashboard() {
        const stats = this.getUserStats();
        const popularMovies = this.getPopularMovies();

        return `
      <div class="analytics-dashboard">
        <h3>Your Activity Dashboard</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.totalSessions}</div>
            <div class="stat-label">Total Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.totalMovieViews}</div>
            <div class="stat-label">Movies Viewed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Math.floor(stats.sessionDuration / 60)}m ${stats.sessionDuration % 60}s</div>
            <div class="stat-label">Session Duration</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.eventsTracked}</div>
            <div class="stat-label">Events Tracked</div>
          </div>
        </div>
        
        ${popularMovies.length > 0 ? `
          <h4>Your Most Viewed Movies</h4>
          <div class="popular-movies-list">
            ${popularMovies.map((movie, index) => `
              <div class="popular-movie-item">
                <span class="rank">${index + 1}</span>
                <span>Movie ID: ${movie.id}</span>
                <span class="views">${movie.views} views</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    }
}

// Initialize analytics
const analytics = new AnalyticsTracker();

// Track page views
window.addEventListener('load', () => {
    analytics.trackEvent('Page', 'view', window.location.pathname);
});

// Track time on page
window.addEventListener('beforeunload', () => {
    const duration = Math.floor((Date.now() - analytics.startTime) / 1000);
    analytics.trackEvent('Session', 'duration', null, duration);
    localStorage.setItem('total_sessions', (parseInt(localStorage.getItem('total_sessions') || '0') + 1).toString());
});