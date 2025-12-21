// Main Application Module for Nexus Email Sender
// Handles application state and page rendering

const App = {
    user: null,
    
    // Initialize the application
    async init() {
        // Initialize background animation
        this.initBackground();
        
        // Check authentication
        await this.checkAuth();
        
        // Initialize router if authenticated
        if (this.user) {
            Router.init();
        }
    },

    // Check authentication status
    async checkAuth() {
        try {
            const response = await API.auth.me();
            if (response.ok && response.data) {
                this.user = response.data;
                this.showApp();
            } else {
                this.showAuth();
            }
        } catch (error) {
            this.showAuth();
        }
    },

    // Show authentication screen
    showAuth() {
        const authScreen = $('#auth-screen');
        const appScreen = $('#app');
        
        if (authScreen) authScreen.style.display = 'flex';
        if (appScreen) appScreen.style.display = 'none';
    },

    // Show main application
    showApp() {
        const authScreen = $('#auth-screen');
        const appScreen = $('#app');
        
        if (authScreen) authScreen.style.display = 'none';
        if (appScreen) {
            appScreen.style.display = 'flex';
            setTimeout(() => appScreen.style.opacity = 1, 100);
        }
    },

    // Initialize background animation
    initBackground() {
        const canvas = document.getElementById('canvas-bg');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        for (let i = 0; i < 50; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2
            });
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#00f3ff';
            
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            
            requestAnimationFrame(animate);
        }
        
        animate();

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    },
};

// Authentication handlers
const Auth = {
    async login() {
        const email = $('#login-email').value;
        const password = $('#login-pass').value;

        if (!UI.validateEmail(email)) {
            UI.toast('Please enter a valid email address', 'error');
            return;
        }

        if (!UI.validatePassword(password)) {
            UI.toast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            const response = await API.auth.login(email, password);
            
            if (response.ok) {
                App.user = response.data;
                App.showApp();
                Router.init();
                UI.toast('Welcome back!', 'success');
            } else {
                UI.toast(response.error || 'Login failed', 'error');
            }
        } catch (error) {
            UI.toast('Login failed: ' + error.message, 'error');
        }
    },

    async signup() {
        const email = $('#signup-email').value;
        const password = $('#signup-pass').value;
        const confirmPass = $('#signup-confirm').value;

        if (!UI.validateEmail(email)) {
            UI.toast('Please enter a valid email address', 'error');
            return;
        }

        if (!UI.validatePassword(password)) {
            UI.toast('Password must be at least 6 characters', 'error');
            return;
        }

        if (password !== confirmPass) {
            UI.toast('Passwords do not match', 'error');
            return;
        }

        try {
            const response = await API.auth.signup(email, password);
            
            if (response.ok) {
                UI.toast('Account created! Please log in.', 'success');
                // Show login form
                this.showLoginForm();
            } else {
                UI.toast(response.error || 'Signup failed', 'error');
            }
        } catch (error) {
            UI.toast('Signup failed: ' + error.message, 'error');
        }
    },

    showSignupForm() {
        const authBox = $('.auth-box');
        if (authBox) {
            authBox.innerHTML = `
                <h2 style="color:var(--primary); margin-bottom: 20px;">NEXUS SIGNUP</h2>
                <input type="email" id="signup-email" placeholder="Email">
                <input type="password" id="signup-pass" placeholder="Password">
                <input type="password" id="signup-confirm" placeholder="Confirm Password">
                <button class="btn" style="width:100%" onclick="Auth.signup()">Create Account</button>
                <p style="margin-top:10px; font-size: 0.8rem; color: #666; cursor: pointer;" onclick="Auth.showLoginForm()">Already have an account? Login</p>
            `;
        }
    },

    showLoginForm() {
        const authBox = $('.auth-box');
        if (authBox) {
            authBox.innerHTML = `
                <h2 style="color:var(--primary); margin-bottom: 20px;">NEXUS LOGIN</h2>
                <input type="email" id="login-email" placeholder="Email">
                <input type="password" id="login-pass" placeholder="Password">
                <button class="btn" style="width:100%" onclick="Auth.login()">Initialize System</button>
                <p style="margin-top:10px; font-size: 0.8rem; color: #666; cursor: pointer;" onclick="Auth.showSignupForm()">Need an account? Sign up</p>
            `;
        }
    },

    async logout() {
        try {
            await API.auth.logout();
            App.user = null;
            window.location.reload();
        } catch (error) {
            UI.toast('Logout failed: ' + error.message, 'error');
        }
    },
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
