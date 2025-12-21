/**
 * Router for Nexus Email Sender
 * Simple hash-based SPA navigation
 */

class Router {
    static current = 'dashboard';
    static views = {};

    /**
     * Register a view/page
     */
    static register(name, renderFn) {
        this.views[name] = renderFn;
    }

    /**
     * Navigate to a page
     */
    static nav(page) {
        this.current = page;
        
        // Update active navigation button
        const navButtons = document.querySelectorAll('nav button');
        navButtons.forEach(b => b.classList.remove('active'));
        
        const navBtn = Array.from(navButtons).find(b => {
            const onclick = b.getAttribute('onclick');
            return onclick && onclick.includes(page);
        });
        
        if (navBtn) {
            navBtn.classList.add('active');
        }
        
        // Update URL hash
        window.location.hash = page;
        
        // Render the page
        this.render();
    }

    /**
     * Render current page
     */
    static render() {
        const main = document.getElementById('main-content');
        if (!main) return;
        
        main.style.opacity = 0;
        
        setTimeout(() => {
            const view = this.views[this.current];
            if (view) {
                main.innerHTML = view();
            } else {
                main.innerHTML = '<h1>Page not found</h1>';
            }
            main.style.opacity = 1;
        }, 200);
    }

    /**
     * Refresh current page (re-render)
     */
    static refresh() {
        this.render();
    }

    /**
     * Initialize router and handle browser back/forward
     */
    static init() {
        // Handle hash changes (browser back/forward)
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'dashboard';
            if (this.views[hash]) {
                this.current = hash;
                this.render();
            }
        });

        // Check initial hash
        const initialHash = window.location.hash.slice(1);
        if (initialHash && this.views[initialHash]) {
            this.current = initialHash;
        }
    }
}

// Make Router available globally
window.Router = Router;
