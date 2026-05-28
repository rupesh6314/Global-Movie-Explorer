// Upcoming Movies Module - Monthly & Industry Wise (Fixed for Indian Movies)
class UpcomingMovies {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.loading = false;
    this.selectedIndustry = 'all';
    this.modal = null;
    this.monthlyData = {};
  }

  // Get upcoming movies grouped by month
  async loadUpcomingMovies(industry = 'all') {
    if (this.loading) return;
    this.loading = true;
    this.selectedIndustry = industry;
    
    const container = document.getElementById('upcomingContainer');
    if (!container) {
      this.loading = false;
      return;
    }
    
    container.innerHTML = '<div class="loading-screen"><div class="loading-spinner-large"></div><p>Loading upcoming movies...</p></div>';
    
    try {
      let allMovies = [];
      
      if (industry === 'indian') {
        // For Indian movies, fetch from multiple Indian language categories
        const indianLanguages = ['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr'];
        
        for (const lang of indianLanguages) {
          try {
            // Fetch upcoming movies by language
            const data = await this.apiClient.fetchAPI(`/discover/movie?with_original_language=${lang}&sort_by=release_date.asc&page=1&release_date.gte=${this.getTodayDate()}&release_date.lte=${this.getFutureDate(6)}`);
            if (data.results && data.results.length > 0) {
              allMovies = [...allMovies, ...data.results];
            }
            
            // Also fetch more pages
            for (let page = 2; page <= 2; page++) {
              const moreData = await this.apiClient.fetchAPI(`/discover/movie?with_original_language=${lang}&sort_by=release_date.asc&page=${page}&release_date.gte=${this.getTodayDate()}&release_date.lte=${this.getFutureDate(6)}`);
              if (moreData.results && moreData.results.length > 0) {
                allMovies = [...allMovies, ...moreData.results];
              }
            }
          } catch (e) {
            console.log(`Error fetching ${lang} movies:`, e);
          }
        }
      } else if (industry === 'hollywood') {
        // For Hollywood movies
        for (let page = 1; page <= 3; page++) {
          const data = await this.apiClient.fetchAPI(`/movie/upcoming?page=${page}`);
          if (data.results && data.results.length > 0) {
            const englishMovies = data.results.filter(m => m.original_language === 'en');
            allMovies = [...allMovies, ...englishMovies];
          }
        }
      } else {
        // All industries - combine both
        // Fetch Hollywood
        for (let page = 1; page <= 2; page++) {
          const hollywoodData = await this.apiClient.fetchAPI(`/movie/upcoming?page=${page}`);
          if (hollywoodData.results && hollywoodData.results.length > 0) {
            const englishMovies = hollywoodData.results.filter(m => m.original_language === 'en');
            allMovies = [...allMovies, ...englishMovies];
          }
        }
        
        // Fetch Indian languages
        const indianLanguages = ['hi', 'te', 'ta', 'ml', 'kn'];
        for (const lang of indianLanguages) {
          try {
            const data = await this.apiClient.fetchAPI(`/discover/movie?with_original_language=${lang}&sort_by=release_date.asc&page=1&release_date.gte=${this.getTodayDate()}&release_date.lte=${this.getFutureDate(6)}`);
            if (data.results && data.results.length > 0) {
              allMovies = [...allMovies, ...data.results];
            }
          } catch (e) {
            console.log(`Error fetching ${lang} movies:`, e);
          }
        }
      }
      
      // Remove duplicates by ID
      const uniqueMovies = [];
      const seenIds = new Set();
      for (const movie of allMovies) {
        if (!seenIds.has(movie.id) && movie.release_date) {
          seenIds.add(movie.id);
          uniqueMovies.push(movie);
        }
      }
      
      if (uniqueMovies.length === 0) {
        container.innerHTML = this.getEmptyStateHTML(industry);
        this.loading = false;
        return;
      }
      
      // Group movies by month
      const groupedByMonth = this.groupMoviesByMonth(uniqueMovies);
      
      if (Object.keys(groupedByMonth).length === 0) {
        container.innerHTML = this.getEmptyStateHTML(industry);
        this.loading = false;
        return;
      }
      
      // Render the grouped view
      this.renderMonthlyGroupedView(groupedByMonth, container);
      
    } catch (error) {
      console.error('Error loading upcoming movies:', error);
      container.innerHTML = '<div class="error-state"><h2>❌ Error loading upcoming movies</h2><button onclick="location.reload()">Retry</button></div>';
    } finally {
      this.loading = false;
    }
  }

  getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getFutureDate(months) {
    const future = new Date();
    future.setMonth(future.getMonth() + months);
    return future.toISOString().split('T')[0];
  }

  getEmptyStateHTML(industry) {
    let message = '';
    if (industry === 'indian') {
      message = `
        <div class="empty-state">
          <h2>🎬 No Indian Upcoming Movies Found</h2>
          <p>Try checking back later for new Indian movie releases!</p>
          <div class="sample-movies">
            <p>Here are some popular Indian movies to watch:</p>
            <div class="sample-buttons">
              <button onclick="window.location.href='details.html?movieId=1121575'">Pushpa 2</button>
              <button onclick="window.location.href='details.html?movieId=947896'">Leo</button>
              <button onclick="window.location.href='details.html?movieId=1027663'">Salaar</button>
              <button onclick="window.location.href='details.html?movieId=1104320'">Jawan</button>
            </div>
          </div>
        </div>
      `;
    } else if (industry === 'hollywood') {
      message = `
        <div class="empty-state">
          <h2>🎬 No Hollywood Upcoming Movies Found</h2>
          <p>Try checking back later for new releases!</p>
        </div>
      `;
    } else {
      message = `
        <div class="empty-state">
          <h2>🎬 No Upcoming Movies Found</h2>
          <p>Try selecting a different industry filter!</p>
        </div>
      `;
    }
    return message;
  }

  // Group movies by month and year
  groupMoviesByMonth(movies) {
    const grouped = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    movies.forEach(movie => {
      if (!movie.release_date) return;
      
      const releaseDate = new Date(movie.release_date);
      if (releaseDate < today) return; // Skip past dates
      
      const monthYear = releaseDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      const monthKey = `${releaseDate.getFullYear()}-${releaseDate.getMonth()}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthName: monthYear,
          movies: []
        };
      }
      
      grouped[monthKey].movies.push({
        ...movie,
        releaseDate: releaseDate,
        daysUntil: Math.ceil((releaseDate - today) / (1000 * 60 * 60 * 24))
      });
    });
    
    // Sort months chronologically
    const sortedGrouped = {};
    Object.keys(grouped).sort().forEach(key => {
      // Sort movies within each month by release date
      grouped[key].movies.sort((a, b) => a.releaseDate - b.releaseDate);
      sortedGrouped[key] = grouped[key];
    });
    
    return sortedGrouped;
  }

  // Render movies grouped by month
  renderMonthlyGroupedView(groupedData, container) {
    container.innerHTML = '';
    
    // Create month selector for quick navigation
    const monthSelector = this.createMonthSelector(groupedData);
    container.appendChild(monthSelector);
    
    // Render each month's movies
    for (const [monthKey, monthData] of Object.entries(groupedData)) {
      const monthSection = this.createMonthSection(monthData.monthName, monthData.movies);
      container.appendChild(monthSection);
    }
  }

  // Create month selector for quick navigation
  createMonthSelector(groupedData) {
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'month-selector';
    selectorDiv.innerHTML = `
      <h3>📅 Jump to Month</h3>
      <div class="month-buttons">
        ${Object.values(groupedData).map((month, index) => `
          <button class="month-jump-btn" data-month="${month.monthName.replace(/ /g, '_')}">
            ${month.monthName}
          </button>
        `).join('')}
      </div>
    `;
    
    // Add click handlers for month jumps
    const buttons = selectorDiv.querySelectorAll('.month-jump-btn');
    buttons.forEach(btn => {
      btn.onclick = () => {
        const monthName = btn.dataset.month.replace(/_/g, ' ');
        const targetSection = document.getElementById(`month-${monthName.replace(/ /g, '_')}`);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          btn.classList.add('active');
          setTimeout(() => btn.classList.remove('active'), 500);
        }
      };
    });
    
    return selectorDiv;
  }

  // Create a section for a specific month
  createMonthSection(monthName, movies) {
    const section = document.createElement('div');
    section.className = 'month-section';
    section.id = `month-${monthName.replace(/ /g, '_')}`;
    
    section.innerHTML = `
      <div class="month-header">
        <h2>📅 ${monthName}</h2>
        <span class="movie-count">${movies.length} movies</span>
      </div>
      <div class="month-movies-grid">
        ${movies.map(movie => this.createMovieCardHTML(movie)).join('')}
      </div>
    `;
    
    return section;
  }

  // Create HTML for individual movie card
  createMovieCardHTML(movie) {
    const posterUrl = movie.poster_path 
      ? `https://image.tmdb.org/t/p/w300${movie.poster_path}`
      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23666' font-size='20' dy='.3em'%3E🎬%3C/text%3E%3C/svg%3E";
    
    const releaseDateStr = movie.releaseDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    let daysLeftText = '';
    if (movie.daysUntil > 0) {
      daysLeftText = `<span class="days-left-badge">${movie.daysUntil} days left</span>`;
    } else if (movie.daysUntil === 0) {
      daysLeftText = `<span class="days-left-badge releasing-soon">Releasing Today! 🎉</span>`;
    } else {
      daysLeftText = `<span class="days-left-badge released">Released</span>`;
    }
    
    const languageName = this.getLanguageName(movie.original_language);
    
    return `
      <div class="upcoming-movie-card" onclick="window.location.href='details.html?movieId=${movie.id}'">
        <img src="${posterUrl}" alt="${movie.title}">
        <div class="movie-card-overlay">
          <div class="movie-card-info">
            <h4>${movie.title}</h4>
            <p class="release-date-sm">📅 ${releaseDateStr}</p>
            <p class="language-badge">${languageName}</p>
            ${daysLeftText}
          </div>
        </div>
      </div>
    `;
  }

  // Get language display name
  getLanguageName(code) {
    const languages = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'ta': 'Tamil',
      'ml': 'Malayalam',
      'kn': 'Kannada',
      'bn': 'Bengali',
      'mr': 'Marathi',
      'pa': 'Punjabi',
      'gu': 'Gujarati',
      'or': 'Odia',
      'fr': 'French',
      'de': 'German',
      'es': 'Spanish',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese'
    };
    return languages[code] || code.toUpperCase();
  }

  // Render the upcoming page modal
  renderUpcomingPage() {
    // Remove existing modal if any
    const existingModal = document.getElementById('upcomingModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'upcoming-modal';
    modal.id = 'upcomingModal';
    modal.innerHTML = `
      <div class="upcoming-modal-content">
        <div class="upcoming-modal-header">
          <h2>🎬 Upcoming Movies</h2>
          <button class="close-upcoming">&times;</button>
        </div>
        
        <div class="upcoming-industry-selector">
          <button class="industry-upcoming-btn active" data-industry="all">🌍 All Industries</button>
          <button class="industry-upcoming-btn" data-industry="hollywood">🎬 Hollywood</button>
          <button class="industry-upcoming-btn" data-industry="indian">🇮🇳 Indian Cinema</button>
        </div>
        
        <div id="upcomingContainer" class="upcoming-container"></div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.modal = modal;
    
    // Make modal active/visible
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
    
    // Setup events
    const closeBtn = modal.querySelector('.close-upcoming');
    closeBtn.onclick = () => this.closeModal();
    
    modal.onclick = (e) => {
      if (e.target === modal) this.closeModal();
    };
    
    // Setup industry buttons
    const industryBtns = modal.querySelectorAll('.industry-upcoming-btn');
    industryBtns.forEach(btn => {
      btn.onclick = () => {
        industryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadUpcomingMovies(btn.dataset.industry);
      };
    });
    
    // Load initial movies
    this.loadUpcomingMovies('indian'); // Default to Indian movies
  }
  
  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('active');
      setTimeout(() => {
        if (this.modal) this.modal.remove();
        this.modal = null;
      }, 300);
    }
  }
}

// Initialize upcoming movies
let upcomingMovies;

// Function to initialize upcoming button
function initUpcomingButton() {
  if (document.getElementById('upcomingBtn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'upcomingBtn';
  btn.className = 'upcoming-floating-btn';
  btn.innerHTML = '🎬 Upcoming';
  btn.onclick = () => {
    if (typeof upcomingMovies !== 'undefined' && upcomingMovies) {
      upcomingMovies.renderUpcomingPage();
    }
  };
  document.body.appendChild(btn);
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const checkInterval = setInterval(() => {
    if (typeof apiClient !== 'undefined') {
      clearInterval(checkInterval);
      upcomingMovies = new UpcomingMovies(apiClient);
      initUpcomingButton();
    }
  }, 100);
});