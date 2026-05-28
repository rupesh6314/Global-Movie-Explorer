document.addEventListener("DOMContentLoaded", () => {

  const searchInput = document.getElementById("liveSearch");
  const resultsBox = document.getElementById("searchResults");

  if (!searchInput || !resultsBox) return;

  let currentAbortController = null;

  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  const handleSearch = debounce((query) => {
    if (!query) {
      resultsBox.classList.remove("active");
      resultsBox.innerHTML = "";
      return;
    }
    searchAPI(query);
  }, 400);

  searchInput.addEventListener("input", (e) => {
    handleSearch(e.target.value.trim());
  });

  async function searchAPI(query) {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    try {
      const data = await fetchAPI(`/search/multi?query=${encodeURIComponent(query)}`, {
        signal: currentAbortController.signal
      });
      
      resultsBox.innerHTML = "";

      if (!data.results || data.results.length === 0) {
        resultsBox.innerHTML = "<div class='search-item'>No Results</div>";
        resultsBox.classList.add("active");
        return;
      }

      createFilmEffect();

      data.results.sort((a, b) => {
      if (a.media_type === "movie" && b.media_type !== "movie") return -1;
      if (a.media_type !== "movie" && b.media_type === "movie") return 1;
      return (b.popularity || 0) - (a.popularity || 0);
    });

    data.results.slice(0, 8).forEach(item => {

      if (item.media_type !== "movie" && item.media_type !== "person") return;

      const imagePath = item.poster_path || item.profile_path;

      const image = imagePath
        ? `https://image.tmdb.org/t/p/w200${imagePath}`
        : "https://via.placeholder.com/50x70?text=No";

      const div = document.createElement("div");
      div.className = "search-item";

      div.innerHTML = `
        <img src="${image}">
        <span>${highlight(item.title || item.name, query)}</span>
      `;

      div.onclick = () => {
        if (item.media_type === "movie")
          location.href = `details.html?movieId=${item.id}`;
        else
          location.href = `details.html?personId=${item.id}`;
      };

      resultsBox.appendChild(div);
    });

    resultsBox.classList.add("active");
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search error:', err);
    }
  }

  function highlight(text, query) {
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(regex, "<span class='highlight'>$1</span>");
  }

  function createFilmEffect() {
    document.querySelectorAll('.film-strip').forEach(el => el.remove());
    const film = document.createElement("img");
    film.src = "https://upload.wikimedia.org/wikipedia/commons/5/5e/Film_strip.svg";
    film.className = "film-strip";
    film.style.left = Math.random() * window.innerWidth + "px";
    document.body.appendChild(film);

    setTimeout(() => film.remove(), 3000);
  }

  document.addEventListener("click", e => {
    if (!document.querySelector(".search-container")?.contains(e.target)) {
      resultsBox.classList.remove("active");
    }
  });

});