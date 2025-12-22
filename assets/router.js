/**
 * Hash-based router for SPA navigation
 * Manages routes and navigation without page reloads
 */

const Router = {
  routes: {},
  currentRoute: null,
  beforeHooks: [],
  afterHooks: [],

  /**
   * Initialize the router
   */
  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  },

  /**
   * Register a route
   */
  register(path, handler) {
    this.routes[path] = handler;
  },

  /**
   * Navigate to a route
   */
  navigate(path, data = {}) {
    window.location.hash = `#${path}`;
    if (data) {
      this.currentData = data;
    }
  },

  /**
   * Get current route path
   */
  getCurrentPath() {
    return window.location.hash.slice(1) || '/dashboard';
  },

  /**
   * Get route parameters
   */
  getParams() {
    const hash = window.location.hash;
    const [path, query] = hash.split('?');
    const params = {};
    
    if (query) {
      query.split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[key] = decodeURIComponent(value);
      });
    }
    
    return params;
  },

  /**
   * Add a before navigation hook
   */
  beforeEach(fn) {
    this.beforeHooks.push(fn);
  },

  /**
   * Add an after navigation hook
   */
  afterEach(fn) {
    this.afterHooks.push(fn);
  },

  /**
   * Handle route changes
   */
  async handleRoute() {
    let path = this.getCurrentPath();
    
    // Run before hooks
    for (const hook of this.beforeHooks) {
      const result = await hook(path, this.currentRoute);
      if (result === false) {
        return; // Navigation cancelled
      }
      if (typeof result === 'string') {
        path = result; // Redirect
      }
    }
    
    this.currentRoute = path;
    
    // Find matching route handler
    const handler = this.routes[path];
    
    if (handler) {
      try {
        await handler(this.currentData || {});
        this.currentData = null;
      } catch (error) {
        console.error('Route handler error:', error);
        UI.toast('Navigation error occurred', 'error');
      }
    } else {
      // 404 - redirect to dashboard
      console.warn('Route not found:', path);
      this.navigate('/dashboard');
    }
    
    // Run after hooks
    for (const hook of this.afterHooks) {
      await hook(path);
    }
    
    // Update active nav button
    this.updateActiveNav(path);
  },

  /**
   * Update active navigation button
   */
  updateActiveNav(path) {
    document.querySelectorAll('nav button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`nav button[data-route="${path}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  },

  /**
   * Refresh current route
   */
  refresh() {
    this.handleRoute();
  },
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Router;
}
