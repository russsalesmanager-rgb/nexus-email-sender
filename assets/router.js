// Hash-based router for NEXUS Email Sender
// Handles navigation between different pages

const Router = {
  currentRoute: 'dashboard',
  currentUser: null,
  
  // Initialize router
  init() {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Handle initial route
    this.handleRoute();
  },
  
  // Parse and handle current route
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const route = hash.split('/')[1] || 'dashboard';
    
    this.currentRoute = route;
    this.navigate(route);
  },
  
  // Navigate to a route
  navigate(route) {
    // Update URL without triggering hashchange
    if (window.location.hash !== `#/${route}`) {
      window.location.hash = `#/${route}`;
    }
    
    // Hide auth screen if logged in
    if (this.currentUser && route !== 'login') {
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) authScreen.style.display = 'none';
      
      const app = document.getElementById('app');
      if (app) app.style.opacity = '1';
    }
    
    // Update active nav button
    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(btn => {
      btn.classList.remove('active');
      const btnRoute = btn.getAttribute('data-route');
      if (btnRoute === route) {
        btn.classList.add('active');
      }
    });
    
    // Render the appropriate page
    this.renderPage(route);
  },
  
  // Render page content
  renderPage(route) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    // Fade out
    mainContent.style.opacity = '0';
    
    setTimeout(() => {
      switch (route) {
        case 'login':
          this.showLogin();
          break;
        case 'dashboard':
          App.renderDashboard();
          break;
        case 'contacts':
          App.renderContacts();
          break;
        case 'lists':
          App.renderLists();
          break;
        case 'templates':
          App.renderTemplates();
          break;
        case 'senders':
          App.renderSenders();
          break;
        case 'campaigns':
          App.renderCampaigns();
          break;
        case 'settings':
          App.renderSettings();
          break;
        default:
          App.renderDashboard();
      }
      
      // Fade in
      mainContent.style.opacity = '1';
    }, 200);
  },
  
  // Show login screen
  showLogin() {
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.style.display = 'flex';
    
    const app = document.getElementById('app');
    if (app) app.style.opacity = '0';
  },
  
  // Refresh current page
  refresh() {
    this.renderPage(this.currentRoute);
  },
};
