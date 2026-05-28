/* =====================================
   GLOBAL VARIABLES
===================================== */

let currentPage = 1;
let totalPages = 1;
let loading = false;
let seenMovies = new Set();
let observer = null;
let hasMoreMovies = true;

/* =====================================
   URL PARAMS (FOR CELEBRITY PAGE)
===================================== */

const urlParams = new URLSearchParams(window.location.search);
const personId = urlParams.get("personId");
const type = urlParams.get("type");

/* =====================================
   LOAD GENRES
===================================== */

async function loadGenres() {
  const genreSelect = document.getElementById("genre");
  if (!genreSelect) return;

  try {
    const data = await fetchAPI("/genre/movie/list");

    genreSelect.innerHTML = `<option value="">All Genres</option>`;

    if (data.genres && data.genres.length > 0) {
      data.genres.forEach(g => {
        const option = document.createElement("option");
        option.value = g.id;
        option.textContent = g.name;
        genreSelect.appendChild(option);
      });
      console.log(`✅ Loaded ${data.genres.length} genres`);
    } else {
      console.warn("No genres received from API");
    }
  } catch (error) {
    console.error("Error loading genres:", error);
    genreSelect.innerHTML = `<option value="">All Genres</option>`;
  }
}

/* =====================================
   HELPER: Get Display Rating
   - Requires minimum 10 votes for accuracy
   - Shows "Coming Soon" for unreleased
   - Shows "Not enough ratings" for low vote counts
===================================== */

function getDisplayRating(movie) {
  const releaseDate = movie.release_date;
  const today = new Date();
  const movieDate = releaseDate ? new Date(releaseDate) : null;

  if (!movieDate || movieDate > today) {
    return { text: "Coming Soon", voteInfo: "" };
  }

  if (
    !movie.vote_average ||
    movie.vote_average === 0 ||
    !movie.vote_count ||
    movie.vote_count < 10
  ) {
    return { text: "Not rated yet", voteInfo: "" };
  }

  const voteInfo = movie.vote_count >= 1000
    ? `(${(movie.vote_count / 1000).toFixed(1)}k votes)`
    : `(${movie.vote_count} votes)`;

  return { text: `⭐ ${movie.vote_average.toFixed(1)}`, voteInfo };
}

/* =====================================
   CREATE MOVIE CARD
===================================== */

function createMovieCard(movie) {
  const card = document.createElement("div");
  card.className = "pro-card";

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w300${movie.poster_path}`
    : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23666' font-size='20' dy='.3em'%3E🎬%3C/text%3E%3C/svg%3E";

  const { text: ratingText, voteInfo } = getDisplayRating(movie);
  const year = movie.release_date ? movie.release_date.split("-")[0] : "Upcoming";
  const title = movie.title || movie.name || "Unknown Title";
  const isUpcoming = !movie.release_date || new Date(movie.release_date) > new Date();

  card.innerHTML = `
    <img src="${posterUrl}" alt="${title}" loading="lazy">
    <div class="card-info">
      <h3>${title.length > 25 ? title.substring(0, 25) + '...' : title}</h3>
      <p class="card-rating">${ratingText} ${voteInfo}</p>
      <p class="card-year">${year}</p>
      ${isUpcoming ? '<span class="coming-soon-badge">🎬 Coming Soon</span>' : ''}
    </div>
  `;

  card.onclick = () => {
    if (movie.id) location.href = `details.html?movieId=${movie.id}`;
  };

  return card;
}

/* =====================================
   BUILD QUERY PARAMS
   Single source of truth for filter params
   used by both loadMovies and loadMoreMovies
===================================== */

function buildMovieParams(page) {
  const industry = document.getElementById("industry")?.value || "";
  const language = document.getElementById("language")?.value || "";
  const genre = document.getElementById("genre")?.value || "";
  const sort = document.getElementById("sort")?.value || "popularity.desc";

  const params = new URLSearchParams();
  params.append('sort_by', sort);
  params.append('page', page);
  params.append('include_adult', 'false');

  if (industry === "hollywood") {
    params.append('with_origin_country', 'US');
    params.append('with_original_language', 'en');
  } else if (industry === "indian") {
    const indianLanguages = ['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr'];
    if (language) {
      params.append('with_original_language', language);
    } else {
      params.append('with_original_language', indianLanguages.join('|'));
    }
    // NOTE: with_origin_country=IN removed — causes 404 on TMDB discover endpoint
  } else {
    // No industry selected — apply standalone language filter if any
    if (language) {
      params.append('with_original_language', language);
    }
  }

  if (genre) {
    params.append('with_genres', genre);
  }

  return params;
}

/* =====================================
   LOAD MOVIES (Main Function)
===================================== */

async function loadMovies(reset = false) {
  if (loading) {
    console.log("Already loading, skipping...");
    return;
  }

  loading = true;
  console.log(`🔄 Loading movies - Page: ${currentPage}, Reset: ${reset}`);

  const container = document.getElementById("movies");
  if (!container) {
    loading = false;
    return;
  }

  if (reset) {
    container.innerHTML = "";
    currentPage = 1;
    seenMovies.clear();
    hasMoreMovies = true;

    const oldSentinel = document.getElementById('scroll-sentinel');
    if (oldSentinel) oldSentinel.remove();

    for (let i = 0; i < 8; i++) {
      const skeleton = document.createElement("div");
      skeleton.className = "skeleton-card";
      skeleton.innerHTML = `
        <div class="skeleton-img"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      `;
      container.appendChild(skeleton);
    }
  }

  /* =====================================
     CELEBRITY MOVIES MODE
  ===================================== */

  if (personId) {
    try {
      const data = await fetchAPI(`/person/${personId}/movie_credits?language=en-US`);

      document.querySelectorAll(".skeleton-card").forEach(el => el.remove());

      let movies = [];

      if (type === "hero" || type === "heroine") {
        movies = data.cast || [];
      } else if (type === "director") {
        movies = (data.crew || []).filter(m => m.job === "Director");
      } else {
        movies = data.cast || [];
      }

      if (!movies || movies.length === 0) {
        container.innerHTML = `<h2 style="text-align:center;margin:40px;">No Movies Found for this Person</h2>`;
        loading = false;
        return;
      }

      const validMovies = movies.filter(movie => movie.poster_path);
      validMovies.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

      validMovies.forEach(movie => {
        if (seenMovies.has(movie.id)) return;
        seenMovies.add(movie.id);
        const card = createMovieCard(movie);
        container.appendChild(card);
      });

      loading = false;
      return;
    } catch (error) {
      console.error("Error loading celebrity movies:", error);
      document.querySelectorAll(".skeleton-card").forEach(el => el.remove());
      container.innerHTML = `<h2 style="text-align:center;margin:40px;">Error loading movies. Please try again.</h2>`;
      loading = false;
      return;
    }
  }

  /* =====================================
     NORMAL MOVIE DISCOVER MODE
  ===================================== */

  const params = buildMovieParams(currentPage);
  const endpoint = `/discover/movie?${params.toString()}`;
  console.log(`📡 Fetching: ${endpoint}`);

  try {
    const data = await fetchAPI(endpoint);
    console.log(`📊 API Response:`, data);

    document.querySelectorAll(".skeleton-card").forEach(el => el.remove());

    if (!data) {
      throw new Error("No data received from API");
    }

    if (data.errors) {
      console.error("API Errors:", data.errors);
      throw new Error(data.errors.join(", "));
    }

    // If API returned an error flag, retry once
    if (data.isError) {
      console.warn("API Error flag set, retrying in 2s...");
      loading = false;
      setTimeout(() => loadMovies(reset), 2000);
      return;
    }

    if (!data.results) {
      console.error("No results in response:", data);
      if (reset) {
        container.innerHTML = `<h2 style="text-align:center;margin:40px;">⚠️ API Error: No results returned</h2>`;
      }
      loading = false;
      return;
    }

    console.log(`✅ Found ${data.results.length} movies on page ${currentPage}`);

    totalPages = Math.min(data.total_pages || 1, 500);
    hasMoreMovies = currentPage < totalPages;

    const newMovies = data.results.filter(movie => movie && movie.id);

    if (newMovies.length === 0) {
      if (reset) {
        container.innerHTML = `
          <div style="text-align:center;margin:40px;padding:40px;">
            <h2 style="color:gold;">🎬 No movies found</h2>
            <p style="margin-top:10px;">Try changing your filters</p>
            <button onclick="resetAndRefresh()" style="margin-top:20px;padding:10px 20px;background:gold;border:none;border-radius:10px;cursor:pointer;">🔄 Reset Filters</button>
          </div>
        `;
      }
      loading = false;
      return;
    }

    const uniqueNewMovies = newMovies.filter(movie => !seenMovies.has(movie.id));

    if (uniqueNewMovies.length === 0 && reset) {
      container.innerHTML = `
        <div style="text-align:center;margin:40px;padding:40px;">
          <h2 style="color:gold;">🎬 No new movies found</h2>
          <button onclick="resetAndRefresh()" style="margin-top:20px;padding:10px 20px;background:gold;border:none;border-radius:10px;cursor:pointer;">🔄 Refresh</button>
        </div>
      `;
      loading = false;
      return;
    }

    uniqueNewMovies.forEach(movie => {
      seenMovies.add(movie.id);
      const card = createMovieCard(movie);
      container.appendChild(card);
    });

    console.log(`✅ Added ${uniqueNewMovies.length} new movies (Total: ${seenMovies.size})`);

    updatePaginationUI();

    if (hasMoreMovies && !personId) {
      setupInfiniteScroll();
    } else if (!hasMoreMovies && seenMovies.size > 0) {
      showEndOfList();
    }

  } catch (error) {
    console.error("❌ Error loading movies:", error);
    document.querySelectorAll(".skeleton-card").forEach(el => el.remove());

    if (container.children.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;margin:40px;padding:40px;background:rgba(255,68,68,0.1);border-radius:20px;">
          <h2 style="color:#ff4444;">❌ Connection Error</h2>
          <p style="margin-top:10px;">${error.message}</p>
          <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:gold;border:none;border-radius:10px;cursor:pointer;">🔄 Retry</button>
        </div>
      `;
    }
  } finally {
    loading = false;
  }
}

/* =====================================
   LOAD MORE MOVIES (Infinite Scroll)
===================================== */

async function loadMoreMovies() {
  if (loading || !hasMoreMovies || currentPage >= totalPages) {
    console.log("Cannot load more:", { loading, hasMoreMovies, currentPage, totalPages });
    return;
  }

  loading = true;
  currentPage++;
  console.log(`📥 Loading more movies - Page: ${currentPage}`);

  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel) {
    sentinel.innerHTML = '<div class="loading-more"><span class="loader"></span> Loading more movies...</div>';
  }

  const params = buildMovieParams(currentPage);
  const endpoint = `/discover/movie?${params.toString()}`;

  try {
    const data = await fetchAPI(endpoint);

    if (data && data.results && data.results.length > 0) {
      const container = document.getElementById("movies");

      const newMovies = data.results.filter(movie =>
        movie && movie.id && !seenMovies.has(movie.id)
      );

      newMovies.forEach(movie => {
        seenMovies.add(movie.id);
        const card = createMovieCard(movie);
        container.appendChild(card);
      });

      console.log(`✅ Loaded ${newMovies.length} more movies`);

      hasMoreMovies = currentPage < totalPages;
      updatePaginationUI();

      if (hasMoreMovies) {
        if (sentinel) sentinel.innerHTML = '';
      } else {
        showEndOfList();
      }
    } else {
      hasMoreMovies = false;
      showEndOfList();
    }

  } catch (error) {
    console.error("Error loading more movies:", error);
    if (sentinel) {
      sentinel.innerHTML = '<div class="load-error">⚠️ Failed to load more. <button onclick="retryLoadMore()">Retry</button></div>';
    }
  } finally {
    loading = false;
  }
}

/* =====================================
   RETRY LOAD MORE
===================================== */

function retryLoadMore() {
  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel) sentinel.innerHTML = '<div class="loading-more">Retrying...</div>';
  loadMoreMovies();
}

/* =====================================
   UPDATE PAGINATION UI
===================================== */

function updatePaginationUI() {
  const pageNumSpan = document.getElementById("pageNumber");
  if (pageNumSpan) pageNumSpan.textContent = currentPage;

  const prevBtn = document.getElementById("prevBtn");
  if (prevBtn) {
    prevBtn.style.display = currentPage <= 1 ? "none" : "inline-block";
  }

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.disabled = !hasMoreMovies;
    nextBtn.style.opacity = hasMoreMovies ? "1" : "0.5";
  }
}

/* =====================================
   SHOW END OF LIST
===================================== */

function showEndOfList() {
  const container = document.getElementById("movies");
  if (!container) return;
  if (document.getElementById('end-of-list-message')) return;

  const endMessage = document.createElement("div");
  endMessage.id = 'end-of-list-message';
  endMessage.style.gridColumn = "1 / -1";
  endMessage.style.textAlign = "center";
  endMessage.style.padding = "40px";
  endMessage.innerHTML = `
    <div style="font-size:48px;">🏁</div>
    <p style="color:gold;margin-top:10px;">You've reached the end!</p>
    <p style="color:#aaa;font-size:12px;">No more movies to load</p>
  `;
  container.appendChild(endMessage);

  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel) sentinel.remove();
}

/* =====================================
   SETUP INFINITE SCROLL
===================================== */

function setupInfiniteScroll() {
  const oldSentinel = document.getElementById('scroll-sentinel');
  if (oldSentinel) oldSentinel.remove();

  const endMessage = document.getElementById('end-of-list-message');
  if (endMessage) endMessage.remove();

  const sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  sentinel.style.height = '20px';
  sentinel.style.margin = '20px 0';
  sentinel.style.textAlign = 'center';

  const pagination = document.querySelector('.pagination');
  if (pagination) {
    pagination.insertAdjacentElement('beforebegin', sentinel);
  } else {
    const moviesGrid = document.getElementById("movies");
    if (moviesGrid) moviesGrid.insertAdjacentElement('afterend', sentinel);
  }

  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !loading && hasMoreMovies && currentPage < totalPages) {
        console.log("👁️ Sentinel visible, loading more...");
        loadMoreMovies();
      }
    });
  }, {
    rootMargin: '200px',
    threshold: 0
  });

  observer.observe(sentinel);
}

/* =====================================
   RESET AND REFRESH
===================================== */

function resetAndRefresh() {
  console.log("🔄 Resetting and refreshing...");
  if (loading) {
    console.log("Skipping reset as already loading");
    return;
  }
  currentPage = 1;
  seenMovies.clear();
  hasMoreMovies = true;
  loading = false;

  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel) sentinel.remove();

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  loadMovies(true);
}

/* =====================================
   PREVIOUS PAGE
===================================== */

function prevPage() {
  if (loading || currentPage <= 1) return;
  console.log("⬅️ Going to previous page");
  currentPage--;
  seenMovies.clear();
  hasMoreMovies = true;

  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel) sentinel.remove();

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  loadMovies(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =====================================
   NEXT PAGE
===================================== */

function nextPage() {
  if (loading || !hasMoreMovies || currentPage >= totalPages) return;
  loadMoreMovies();
}

/* =====================================
   SETUP FILTERS
===================================== */

function setupFilters() {
  const filterIds = ["industry", "language", "genre", "sort"];
  filterIds.forEach(filterId => {
    const element = document.getElementById(filterId);
    if (element) {
      element.addEventListener("change", () => {
        console.log(`🔄 Filter changed: ${filterId} = ${element.value}`);
        resetAndRefresh();
      });
    }
  });
}

/* =====================================
   INDUSTRY FILTER LOGIC
===================================== */

function setupIndustryFilter() {
  const indSelect = document.getElementById("industry");
  const langSelect = document.getElementById("language");

  if (!indSelect || !langSelect) return;

  indSelect.addEventListener("change", () => {
    if (indSelect.value === "hollywood") {
      Array.from(langSelect.options).forEach(opt => {
        opt.style.display = (opt.value && opt.value !== "en") ? "none" : "block";
      });
      langSelect.value = "en";
    } else {
      Array.from(langSelect.options).forEach(opt => {
        opt.style.display = "block";
      });
      if (indSelect.value === "indian" && langSelect.value === "en") {
        langSelect.value = "";
      }
    }
    resetAndRefresh();
  });
}

/* =====================================
   INITIALIZATION
===================================== */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎬 Movie Explorer Initialized");

  if (!document.querySelector('#movie-styles')) {
    const styles = document.createElement('style');
    styles.id = 'movie-styles';
    styles.textContent = `
      .loader {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid #fff;
        border-radius: 50%;
        border-top-color: gold;
        animation: spin 0.6s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .loading-more {
        text-align: center;
        padding: 20px;
        color: gold;
        font-size: 14px;
      }
      .load-error {
        text-align: center;
        padding: 20px;
        color: #ff4444;
      }
      .load-error button {
        margin-left: 10px;
        padding: 5px 15px;
        background: gold;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
      }
      .card-rating {
        font-size: 13px;
        color: #ffd700;
        margin: 2px 0;
      }
      .card-year {
        font-size: 12px;
        color: #aaa;
        margin: 2px 0;
      }
    `;
    document.head.appendChild(styles);
  }

  try {
    const healthCheck = await fetch('/health');
    const health = await healthCheck.json();
    console.log("🏥 Health check:", health);
  } catch (err) {
    console.error("❌ Health check failed:", err);
  }

  if (!personId) {
    setupFilters();
    setupIndustryFilter();
    await loadGenres();
  }

  await loadMovies(true);
});