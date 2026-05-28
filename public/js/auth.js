// User Authentication and Personalization System with Persistent Login
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
                // Check if session is still valid (7 days expiry)
                if (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    const usernameKey = session.userId;
                    if (this.users[usernameKey]) {
                        this.currentUser = this.users[usernameKey];
                        // Explicitly bind username to prevent key mapping drops
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
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        localStorage.setItem('current_session', JSON.stringify(session));
    }

    clearSession() {
        localStorage.removeItem('current_session');
    }

    setupAutoSave() {
        // Auto-save user data every 30 seconds
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
        }, 1500);
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getWatchlist() {
        return this.currentUser ? this.currentUser.watchlist : [];
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

    updateUserUI() {
        const userBtn = document.getElementById('userBtn');
        if (!userBtn) return;
        
        if (this.currentUser) {
            userBtn.innerHTML = `👤 ${this.currentUser.username}`;
            userBtn.onclick = () => {
                if(confirm('Do you want to logout?')) this.logout();
            };
        } else {
            userBtn.innerHTML = `👤 Login`;
            userBtn.onclick = () => this.renderAuthModal();
        }
    }

    renderAuthModal() {
        console.log("Trigger auth login modal rendering...");
        // Define modal window wrapper interface mapping here
    }

    showNotification(message, type = 'info') {
        console.log(`[Notification - ${type.toUpperCase()}] ${message}`);
        // Optional placeholder hook for a custom toaster/toast notification system
    }
}

// Global initialization singleton instance binding
const movieUser = new MovieAppUser();
