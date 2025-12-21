// Router Module for Nexus Email Sender
// Handles hash-based SPA routing

const Router = {
    current: 'dashboard',
    routes: {},

    // Initialize router
    init() {
        // Handle hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
        
        // Handle initial load
        if (window.location.hash) {
            this.handleRoute();
        } else {
            this.nav('dashboard');
        }
    },

    // Register a route handler
    register(path, handler) {
        this.routes[path] = handler;
    },

    // Navigate to a route
    nav(page) {
        window.location.hash = `#/${page}`;
    },

    // Handle route changes
    handleRoute() {
        const hash = window.location.hash.substring(2) || 'dashboard';
        this.current = hash;
        
        // Update navigation active state
        const buttons = $$('nav button');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            const onclick = btn.getAttribute('onclick');
            if (onclick && onclick.includes(`'${hash}'`)) {
                btn.classList.add('active');
            }
        });

        // Render the page
        const main = $('#main-content');
        if (main) {
            main.style.opacity = 0;
            
            setTimeout(() => {
                const handler = this.routes[hash];
                if (handler && typeof handler === 'function') {
                    handler(main);
                } else {
                    main.innerHTML = '<h1>Page Not Found</h1><p>The page you requested does not exist.</p>';
                }
                main.style.opacity = 1;
            }, 200);
        }
    },

    // Refresh current page
    refresh() {
        this.handleRoute();
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
}
