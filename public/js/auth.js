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
            return { success: false };
        }

        if (password.length < 4) {
            this.showNotification('Password must be at least 4 characters', 'error');
            return { success: false };
        }

        if (!email.includes('@')) {
            this.showNotification('Please enter a valid email address', 'error');
            return { success: false };
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
            return { success: false };
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
        
        // Refresh page to update UI
        setTimeout(() => {
            window.location.reload();
        }, 500);
        
        return { success: true };
    }

    logout() {
        const username = this.currentUser?.username;
        this.currentUser = null;
        this.clearSession();

        this.showNotification(`Goodbye, ${username}! See you soon 👋`, 'info');
        this.updateUserUI();

        setTimeout(() => {
            window.location.reload();
        }, 500);
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
            userBtn.onclick = () => this.showUserMenu();
        } else {
            userBtn.innerHTML = `👤 Login`;
            userBtn.onclick = () => this.renderAuthModal();
        }
        userBtn.style.cursor = 'pointer';
    }

    showUserMenu() {
        // Remove existing menu
        const existingMenu = document.querySelector('.user-menu');
        if (existingMenu) existingMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: rgba(20, 26, 47, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
            z-index: 1000;
            min-width: 200px;
        `;
        
        menu.innerHTML = `
            <div style="color: gold; margin-bottom: 10px; font-weight: bold;">${this.currentUser.username}</div>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <span>📝 ${this.getWatchlist().length}</span>
                <span>❤️ ${this.getFavorites().length}</span>
            </div>
            <button onclick="window.location.href='watchlist.html'" style="display: block; width: 100%; padding: 8px; margin: 5px 0; background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 5px; cursor: pointer;">📝 My Watchlist</button>
            <button onclick="window.location.href='favorites.html'" style="display: block; width: 100%; padding: 8px; margin: 5px 0; background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 5px; cursor: pointer;">❤️ My Favorites</button>
            <button onclick="window.location.href='history.html'" style="display: block; width: 100%; padding: 8px; margin: 5px 0; background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 5px; cursor: pointer;">🕐 Watch History</button>
            <hr style="margin: 10px 0; border-color: rgba(255,255,255,0.1);">
            <button id="logoutBtn" style="display: block; width: 100%; padding: 8px; margin: 5px 0; background: rgba(255,255,255,0.1); border: none; color: #ff4444; border-radius: 5px; cursor: pointer;">🚪 Logout</button>
        `;
        
        document.body.appendChild(menu);
        
        document.getElementById('logoutBtn').onclick = () => {
            this.logout();
            menu.remove();
        };
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== document.getElementById('userBtn')) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    renderAuthModal() {
        // Remove existing modal
        const existingModal = document.getElementById('authModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'authModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #141a2f, #0b0f1a); padding: 30px; border-radius: 20px; max-width: 400px; width: 90%; position: relative;">
                <span id="closeModal" style="position: absolute; top: 15px; right: 20px; font-size: 30px; cursor: pointer; color: #999;">&times;</span>
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button id="loginTab" class="auth-tab" style="flex:1; padding:10px; background: gold; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Login</button>
                    <button id="registerTab" class="auth-tab" style="flex:1; padding:10px; background: rgba(255,255,255,0.1); border:none; border-radius:5px; cursor:pointer; color:white;">Register</button>
                </div>
                
                <div id="loginForm">
                    <h3 style="margin-bottom:20px; color:gold;">Welcome Back!</h3>
                    <input type="text" id="loginUsername" placeholder="Username" style="width:100%; padding:10px; margin:10px 0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:white;">
                    <input type="password" id="loginPassword" placeholder="Password" style="width:100%; padding:10px; margin:10px 0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:white;">
                    <label style="display: flex; align-items: center; gap: 8px; margin: 10px 0; cursor: pointer;">
                        <input type="checkbox" id="rememberMe"> 
                        <span style="color: #aaa; font-size: 12px;">Remember me</span>
                    </label>
                    <button id="doLogin" style="width:100%; padding:10px; margin-top:15px; background:gold; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Login</button>
                </div>
                
                <div id="registerForm" style="display: none;">
                    <h3 style="margin-bottom:20px; color:gold;">Create Account</h3>
                    <input type="text" id="regUsername" placeholder="Username" style="width:100%; padding:10px; margin:10px 0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:white;">
                    <input type="email" id="regEmail" placeholder="Email" style="width:100%; padding:10px; margin:10px 0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:white;">
                    <input type="password" id="regPassword" placeholder="Password (min 4 chars)" style="width:100%; padding:10px; margin:10px 0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:white;">
                    <label style="display: flex; align-items: center; gap: 8px; margin: 10px 0; cursor: pointer;">
                        <input type="checkbox" id="regRememberMe"> 
                        <span style="color: #aaa; font-size: 12px;">Remember me</span>
                    </label>
                    <button id="doRegister" style="width:100%; padding:10px; margin-top:15px; background:gold; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Register</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal
        document.getElementById('closeModal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        
        // Tab switching
        document.getElementById('loginTab').onclick = () => {
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginTab').style.background = 'gold';
            document.getElementById('loginTab').style.color = 'black';
            document.getElementById('registerTab').style.background = 'rgba(255,255,255,0.1)';
            document.getElementById('registerTab').style.color = 'white';
        };
        
        document.getElementById('registerTab').onclick = () => {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'block';
            document.getElementById('registerTab').style.background = 'gold';
            document.getElementById('registerTab').style.color = 'black';
            document.getElementById('loginTab').style.background = 'rgba(255,255,255,0.1)';
            document.getElementById('loginTab').style.color = 'white';
        };
        
        // Login handler
        document.getElementById('doLogin').onclick = () => {
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            if (!username || !password) {
                this.showNotification('Please enter username and password', 'error');
                return;
            }
            
            const result = this.login(username, password, rememberMe);
            if (result.success) {
                modal.remove();
            }
        };
        
        // Enter key for login
        document.getElementById('loginPassword').onkeypress = (e) => {
            if (e.key === 'Enter') document.getElementById('doLogin').click();
        };
        
        // Register handler
        document.getElementById('doRegister').onclick = () => {
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const rememberMe = document.getElementById('regRememberMe').checked;
            
            if (!username || !email || !password) {
                this.showNotification('Please fill all fields', 'error');
                return;
            }
            
            const result = this.register(username, email, password, rememberMe);
            if (result.success) {
                // Switch to login tab
                document.getElementById('loginTab').click();
                document.getElementById('loginUsername').value = username;
                document.getElementById('loginPassword').value = '';
                this.showNotification('Registration successful! Please login.', 'success');
            }
        };
        
        // Enter key for register
        document.getElementById('regPassword').onkeypress = (e) => {
            if (e.key === 'Enter') document.getElementById('doRegister').click();
        };
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'linear-gradient(135deg, #ff4444, #cc0000)' : 'linear-gradient(135deg, #ffd700, #ffaa00)'};
            color: ${type === 'error' ? 'white' : 'black'};
            padding: 12px 20px;
            border-radius: 10px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        `;
        notification.innerHTML = `<span>${message}</span><button style="background:none; border:none; font-size:20px; cursor:pointer; color:inherit;" onclick="this.parentElement.remove()">×</button>`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 3000);
    }
}

// Initialize user system
const movieUser = new MovieAppUser();
