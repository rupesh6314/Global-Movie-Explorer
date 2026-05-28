class MovieAppUser {
    constructor() {
        this.currentUser = null;
        this.users = this.loadUsers();
        this.loadCurrentUser();
        this.setupAutoSave();
    }

    loadUsers() {
        const users = localStorage.getItem('movie_app_users');
        return users ? JSON.parse(users) : {};
    }

    saveUsers() {
        localStorage.setItem('movie_app_users', JSON.stringify(this.users));
    }

    loadCurrentUser() {
        // Check for existing session
        const savedSession = localStorage.getItem('current_session');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    const usernameKey = session.userId;
                    if (this.users[usernameKey]) {
                        this.currentUser = this.users[usernameKey];
                        this.currentUser.id = usernameKey;
                        console.log(`✅ Welcome back, ${this.currentUser.username}!`);
                        this.updateUserUI();
                        return;
                    }
                }
            } catch (e) {
                console.error("Error loading session:", e);
            }
        }

        // Check for "Remember Me" option
        const rememberMe = localStorage.getItem('remember_me');
        if (rememberMe === 'true') {
            const savedUser = localStorage.getItem('saved_user');
            if (savedUser) {
                try {
                    const userData = JSON.parse(savedUser);
                    if (this.users[userData.username]) {
                        this.currentUser = this.users[userData.username];
                        this.currentUser.id = userData.username;
                        this.saveSession(userData.username);
                        console.log(`✅ Auto-logged in as ${this.currentUser.username}`);
                        this.updateUserUI();
                    }
                } catch (e) {
                    console.error("Error loading saved user:", e);
                }
            }
        }
    }

    saveSession(userId) {
        const session = {
            userId: userId,
            timestamp: Date.now(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
        };
        localStorage.setItem('current_session', JSON.stringify(session));
    }

    clearSession() {
        localStorage.removeItem('current_session');
    }

    setupAutoSave() {
        setInterval(() => {
            if (this.currentUser && this.currentUser.id) {
                this.users[this.currentUser.id] = this.currentUser;
                this.saveUsers();
                console.log("💾 Auto-saved user data");
            }
        }, 30000);
    }

    register(username, email, password, rememberMe = false) {
        if (this.users[username]) {
            this.showNotification('Username already exists!', 'error');
            return { success: false, error: 'Username already exists' };
        }

        if (password.length < 4) {
            this.showNotification('Password must be at least 4 characters', 'error');
            return { success: false, error: 'Password too short' };
        }

        if (!email.includes('@')) {
            this.showNotification('Please enter a valid email address', 'error');
            return { success: false, error: 'Invalid email' };
        }

        this.users[username] = {
            username,
            email,
            password: btoa(password),
            watchlist: [],
            favorites: [],
            ratings: {},
            reviews: [],
            watchHistory: [],
            preferences: {
                theme: 'dark',
                notifications: true,
                language: 'en'
            },
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        this.saveUsers();

        if (rememberMe) {
            localStorage.setItem('remember_me', 'true');
            localStorage.setItem('saved_user', JSON.stringify({ username, email }));
        }

        this.showNotification('Registration successful! Please login.', 'success');
        return { success: true };
    }

    login(username, password, rememberMe = false) {
        const user = this.users[username];
        if (!user || atob(user.password) !== password) {
            this.showNotification('Invalid username or password!', 'error');
            return { success: false, error: 'Invalid credentials' };
        }

        this.currentUser = user;
        this.currentUser.id = username;
        this.currentUser.lastLogin = new Date().toISOString();

        this.saveSession(username);
        this.users[username] = this.currentUser;
        this.saveUsers();

        if (rememberMe) {
            localStorage.setItem('remember_me', 'true');
            localStorage.setItem('saved_user', JSON.stringify({ username, email: user.email }));
        } else {
            localStorage.removeItem('remember_me');
            localStorage.removeItem('saved_user');
        }

        this.showNotification(`Welcome back, ${username}! 🎬`, 'success');
        this.updateUserUI();
        return { success: true };
    }

    logout() {
        const username = this.currentUser?.username;
        this.currentUser = null;
        this.clearSession();

        this.showNotification(`Goodbye, ${username}! See you soon 👋`, 'info');
        this.updateUserUI();
        return { success: true };
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getWatchlist() {
        return this.currentUser ? this.currentUser.watchlist : [];
    }

    getFavorites() {
        return this.currentUser ? this.currentUser.favorites : [];
    }

    getWatchHistory() {
        return this.currentUser ? this.currentUser.watchHistory || [] : [];
    }

    addToWatchlist(movie) {
        if (!this.currentUser) {
            this.showNotification('Please login first!', 'error');
            return false;
        }

        if (!this.currentUser.watchlist.find(m => m.id === movie.id)) {
            this.currentUser.watchlist.push({
                id: movie.id,
                title: movie.title,
                poster: movie.poster_path,
                addedAt: new Date().toISOString()
            });
            this.users[this.currentUser.id] = this.currentUser;
            this.saveUsers();
            this.showNotification(`Added "${movie.title}" to watchlist! 📝`, 'success');
            return true;
        } else {
            this.showNotification('Movie already in watchlist', 'info');
            return false;
        }
    }

    removeFromWatchlist(movieId) {
        if (!this.currentUser) return false;

        this.currentUser.watchlist = this.currentUser.watchlist.filter(m => m.id !== movieId);
        this.users[this.currentUser.id] = this.currentUser;
        this.saveUsers();
        this.showNotification('Removed from watchlist', 'info');
        return true;
    }

    addToFavorites(movie) {
        if (!this.currentUser) {
            this.showNotification('Please login first!', 'error');
            return false;
        }

        if (!this.currentUser.favorites.find(m => m.id === movie.id)) {
            this.currentUser.favorites.push({
                id: movie.id,
                title: movie.title,
                poster: movie.poster_path,
                addedAt: new Date().toISOString()
            });
            this.users[this.currentUser.id] = this.currentUser;
            this.saveUsers();
            this.showNotification(`Added "${movie.title}" to favorites! ❤️`, 'success');
            return true;
        } else {
            this.showNotification('Movie already in favorites', 'info');
            return false;
        }
    }

    removeFromFavorites(movieId) {
        if (!this.currentUser) return false;

        this.currentUser.favorites = this.currentUser.favorites.filter(m => m.id !== movieId);
        this.users[this.currentUser.id] = this.currentUser;
        this.saveUsers();
        this.showNotification('Removed from favorites', 'info');
        return true;
    }

    addToWatchHistory(movie) {
        if (!this.currentUser) return;
        
        this.currentUser.watchHistory = this.currentUser.watchHistory || [];
        const existing = this.currentUser.watchHistory.find(m => m.id === movie.id);
        
        if (existing) {
            existing.watchedAt = new Date().toISOString();
            existing.watchCount = (existing.watchCount || 0) + 1;
        } else {
            this.currentUser.watchHistory.unshift({
                id: movie.id,
                title: movie.title,
                poster: movie.poster_path,
                watchedAt: new Date().toISOString(),
                watchCount: 1
            });
        }
        
        this.currentUser.watchHistory = this.currentUser.watchHistory.slice(0, 50);
        this.users[this.currentUser.id] = this.currentUser;
        this.saveUsers();
    }

    updateUserUI() {
        const userBtn = document.getElementById('userBtn');
        if (!userBtn) return;
        
        if (this.currentUser) {
            userBtn.innerHTML = `👤 ${this.currentUser.username}`;
            userBtn.onclick = (e) => {
                e.stopPropagation();
                this.showUserMenu();
            };
        } else {
            userBtn.innerHTML = `👤 Login`;
            userBtn.onclick = (e) => {
                e.stopPropagation();
                this.renderAuthModal();
            };
        }
        userBtn.style.cursor = 'pointer';
    }

    showUserMenu() {
        // Remove existing menu
        const existingMenu = document.querySelector('.user-menu');
        if (existingMenu) existingMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.innerHTML = `
            <div class="user-menu-content">
                <h4>${this.currentUser.username}</h4>
                <div class="user-stats">
                    <span>📝 ${this.getWatchlist().length} Watchlist</span>
                    <span>❤️ ${this.getFavorites().length} Favorites</span>
                </div>
                <button onclick="window.location.href='watchlist.html'">📝 My Watchlist</button>
                <button onclick="window.location.href='favorites.html'">❤️ My Favorites</button>
                <button onclick="window.location.href='history.html'">🕐 Watch History</button>
                <hr style="margin: 10px 0; border-color: rgba(255,255,255,0.1);">
                <button id="logoutBtn">🚪 Logout</button>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Position menu below the user button
        const userBtn = document.getElementById('userBtn');
        if (userBtn) {
            const rect = userBtn.getBoundingClientRect();
            menu.style.top = `${rect.bottom + 5}px`;
            menu.style.right = `${window.innerWidth - rect.right}px`;
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                this.logout();
                menu.remove();
                this.updateUserUI();
            };
        }
        
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== userBtn) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    renderAuthModal() {
        // Remove existing modal
        const existingModal = document.getElementById('authModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'authModal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Login</button>
                    <button class="auth-tab" data-tab="register">Register</button>
                </div>
                
                <div id="loginForm" class="auth-form active">
                    <h3>Welcome Back!</h3>
                    <input type="text" id="loginUsername" placeholder="Username" autocomplete="off">
                    <input type="password" id="loginPassword" placeholder="Password">
                    <label style="display: flex; align-items: center; gap: 8px; margin: 10px 0; cursor: pointer;">
                        <input type="checkbox" id="rememberMe"> 
                        <span style="color: #aaa; font-size: 12px;">Remember me</span>
                    </label>
                    <button id="loginBtn">Login</button>
                </div>
                
                <div id="registerForm" class="auth-form">
                    <h3>Create Account</h3>
                    <input type="text" id="regUsername" placeholder="Username" autocomplete="off">
                    <input type="email" id="regEmail" placeholder="Email" autocomplete="off">
                    <input type="password" id="regPassword" placeholder="Password (min 4 characters)">
                    <label style="display: flex; align-items: center; gap: 8px; margin: 10px 0; cursor: pointer;">
                        <input type="checkbox" id="regRememberMe"> 
                        <span style="color: #aaa; font-size: 12px;">Remember me</span>
                    </label>
                    <button id="registerBtn">Register</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup close functionality
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.onclick = () => modal.remove();
        
        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        // Tab switching
        const tabs = modal.querySelectorAll('.auth-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const forms = modal.querySelectorAll('.auth-form');
                forms.forEach(form => form.classList.remove('active'));
                modal.querySelector(`#${tab.dataset.tab}Form`).classList.add('active');
            };
        });
        
        // Login button handler
        const loginBtn = modal.querySelector('#loginBtn');
        loginBtn.onclick = () => {
            const username = modal.querySelector('#loginUsername').value.trim();
            const password = modal.querySelector('#loginPassword').value;
            const rememberMe = modal.querySelector('#rememberMe')?.checked || false;
            
            if (!username || !password) {
                this.showNotification('Please enter username and password', 'error');
                return;
            }
            
            const result = this.login(username, password, rememberMe);
            if (result.success) {
                modal.remove();
                this.updateUserUI();
                window.location.reload();
            }
        };
        
        // Enter key for login
        const loginPassword = modal.querySelector('#loginPassword');
        loginPassword.onkeypress = (e) => {
            if (e.key === 'Enter') loginBtn.click();
        };
        
        // Register button handler
        const registerBtn = modal.querySelector('#registerBtn');
        registerBtn.onclick = () => {
            const username = modal.querySelector('#regUsername').value.trim();
            const email = modal.querySelector('#regEmail').value.trim();
            const password = modal.querySelector('#regPassword').value;
            const rememberMe = modal.querySelector('#regRememberMe')?.checked || false;
            
            if (!username || !email || !password) {
                this.showNotification('Please fill all fields', 'error');
                return;
            }
            
            const result = this.register(username, email, password, rememberMe);
            if (result.success) {
                // Switch to login tab
                modal.querySelector('.auth-tab[data-tab="login"]').click();
                modal.querySelector('#loginUsername').value = username;
                modal.querySelector('#loginPassword').value = '';
                this.showNotification('Registration successful! Please login.', 'success');
            }
        };
        
        // Enter key for register
        const regPassword = modal.querySelector('#regPassword');
        regPassword.onkeypress = (e) => {
            if (e.key === 'Enter') registerBtn.click();
        };
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotif = document.querySelector('.notification');
        if (existingNotif) existingNotif.remove();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 3000);
    }
}

// Initialize user system
const movieUser = new MovieAppUser();
