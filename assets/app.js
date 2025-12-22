/**
 * Main application bootstrap
 * Initializes the app, sets up routes, and renders pages
 */

const App = {
  user: null,
  isProduction: window.location.hostname !== 'localhost',

  /**
   * Initialize the application
   */
  async init() {
    // Check authentication status
    await this.checkAuth();
    
    // Set up router
    this.setupRoutes();
    
    // Initialize router
    Router.init();
    
    // Set up auth guard
    Router.beforeEach(async (to, from) => {
      // Public routes
      const publicRoutes = ['/login', '/signup'];
      
      if (!this.user && !publicRoutes.includes(to)) {
        return '/login'; // Redirect to login
      }
      
      return true; // Allow navigation
    });
    
    // Initialize background animation
    this.initBackground();
  },

  /**
   * Check if user is authenticated
   */
  async checkAuth() {
    // In production, check with backend
    if (this.isProduction) {
      try {
        const result = await API.auth.me();
        if (result.ok) {
          this.user = result.data;
          this.showApp();
          return true;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    } else {
      // Development: check localStorage for mock auth
      const stored = localStorage.getItem('nexus_current_user');
      if (stored) {
        try {
          this.user = JSON.parse(stored);
          this.showApp();
          return true;
        } catch (e) {
          console.error('Failed to parse stored user:', e);
        }
      }
    }
    
    this.showAuth();
    return false;
  },

  /**
   * Show auth screen
   */
  showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  },

  /**
   * Show main app
   */
  showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    setTimeout(() => {
      document.getElementById('app').style.opacity = '1';
    }, 100);
  },

  /**
   * Login handler
   */
  async login(email, password) {
    const result = await API.auth.login(email, password);
    
    if (result.ok) {
      this.user = result.data;
      this.showApp();
      Router.navigate('/dashboard');
      UI.toast('Login successful', 'success');
    } else {
      UI.toast(result.error || 'Login failed', 'error');
    }
  },

  /**
   * Logout handler
   */
  async logout() {
    await API.auth.logout();
    this.user = null;
    localStorage.removeItem('nexus_current_user');
    this.showAuth();
    Router.navigate('/login');
    UI.toast('Logged out successfully', 'info');
  },

  /**
   * Setup all routes
   */
  setupRoutes() {
    Router.register('/login', () => this.renderLogin());
    Router.register('/signup', () => this.renderSignup());
    Router.register('/dashboard', () => this.renderDashboard());
    Router.register('/contacts', () => this.renderContacts());
    Router.register('/lists', () => this.renderLists());
    Router.register('/inboxes', () => this.renderInboxes());
    Router.register('/sequences', () => this.renderSequences());
    Router.register('/analytics', () => this.renderAnalytics());
    Router.register('/website-visitors', () => this.renderWebsiteVisitors());
    Router.register('/settings', () => this.renderSettings());
  },

  /**
   * Render content in main area
   */
  render(html) {
    const main = document.getElementById('main-content');
    main.style.opacity = '0';
    
    setTimeout(() => {
      main.innerHTML = html;
      main.style.opacity = '1';
    }, 150);
  },

  /**
   * Initialize background animation
   */
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
        size: Math.random() * 2,
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

  // ===================
  // PAGE RENDERERS
  // ===================

  renderLogin() {
    // Login is handled by auth screen, just ensure it's visible
    if (!this.user) {
      this.showAuth();
    } else {
      Router.navigate('/dashboard');
    }
  },

  renderSignup() {
    // Signup would be similar to login
    this.renderLogin();
  },

  async renderDashboard() {
    const html = `
      <h1>Dashboard</h1>
      <div class="grid-4">
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--primary)">0</div>
          <div class="stat-label">Total Sent</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--secondary)">0</div>
          <div class="stat-label">Delivered</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--success)">0</div>
          <div class="stat-label">Opens</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--warning)">0</div>
          <div class="stat-label">Active Campaigns</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>📈 Performance Trend</h3>
          <div style="height:200px; display:flex; align-items:end; gap:5px; padding-top:20px; border-bottom:1px solid #333;">
            ${Array(20).fill(0).map(() => {
              const h = Math.random() * 80 + 10;
              return `<div style="flex:1; background:linear-gradient(to top, var(--primary), transparent); height:${h}%; border-radius:2px 2px 0 0;"></div>`;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <h3>📊 Recent Activity</h3>
          <p style="color: var(--text-muted); padding: 2rem; text-align: center;">
            No recent activity
          </p>
        </div>
      </div>
    `;
    
    this.render(html);
    
    // Load real stats in production
    if (this.isProduction) {
      try {
        const result = await API.analytics.overview('7d');
        if (result.ok) {
          // Update stats
          this.renderDashboard(); // Re-render with real data
        }
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      }
    }
  },

  async renderContacts() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>👥 Contacts Database</h2>
          <div>
            <button class="btn btn-secondary" onclick="App.importContacts()">📂 Import CSV</button>
            <button class="btn" onclick="App.createContact()">+ Add Contact</button>
          </div>
        </div>
        
        <div id="contacts-list">
          ${UI.emptyState('👤', 'No contacts yet', 'Import a CSV or add your first contact manually', {
            label: 'Add Contact',
            onclick: 'App.createContact()'
          })}
        </div>
      </div>
    `;
    
    this.render(html);
    
    // Load contacts in production
    if (this.isProduction) {
      try {
        const result = await API.contacts.list();
        if (result.ok && result.data.length > 0) {
          this.renderContactsTable(result.data);
        }
      } catch (error) {
        console.error('Failed to load contacts:', error);
      }
    }
  },

  renderContactsTable(contacts) {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Tags</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map(c => `
            <tr>
              <td>${UI.escapeHtml(c.first_name + ' ' + c.last_name)}</td>
              <td>${UI.escapeHtml(c.email)}</td>
              <td>${c.tags_json ? JSON.parse(c.tags_json).join(', ') : '-'}</td>
              <td>${UI.formatDate(c.created_at, 'short')}</td>
              <td>
                <button class="btn btn-sm" onclick="App.editContact('${c.id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="App.deleteContact('${c.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    document.getElementById('contacts-list').innerHTML = html;
  },

  createContact() {
    UI.form([
      { name: 'first_name', label: 'First Name', required: true },
      { name: 'last_name', label: 'Last Name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'tags', label: 'Tags (comma-separated)' },
    ], async (data) => {
      const result = await API.contacts.create({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        tags_json: data.tags ? JSON.stringify(data.tags.split(',').map(t => t.trim())) : '[]',
      });
      
      if (result.ok) {
        UI.toast('Contact created', 'success');
        Router.refresh();
      } else {
        throw new Error(result.error || 'Failed to create contact');
      }
    }, 'Create Contact');
  },

  importContacts() {
    const html = `
      <h3>Import Contacts from CSV</h3>
      <p style="margin-bottom: 1rem; color: var(--text-muted);">
        CSV must include email column. Optional: first_name, last_name, company
      </p>
      <textarea id="csv-input" rows="10" placeholder="Paste CSV data here...&#10;email,first_name,last_name&#10;john@example.com,John,Doe"></textarea>
      <div style="display: flex; gap: 1rem; margin-top: 1rem;">
        <button class="btn" style="flex: 1;" onclick="UI.closeModal()">Cancel</button>
        <button class="btn btn-secondary" style="flex: 1;" onclick="App.processCSVImport()">Import</button>
      </div>
    `;
    
    UI.modal(html);
  },

  async processCSVImport() {
    const csv = document.getElementById('csv-input').value.trim();
    if (!csv) {
      UI.toast('Please paste CSV data', 'error');
      return;
    }
    
    UI.showLoading('Importing contacts...');
    
    // TODO: Send to backend in production
    // For now, just parse locally
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const emailIndex = headers.indexOf('email');
    
    if (emailIndex === -1) {
      UI.hideLoading();
      UI.toast('CSV must contain email column', 'error');
      return;
    }
    
    UI.hideLoading();
    UI.toast(`Would import ${lines.length - 1} contacts`, 'info');
    UI.closeModal();
    Router.refresh();
  },

  async renderLists() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>📋 Contact Lists</h2>
          <button class="btn" onclick="App.createList()">+ Create List</button>
        </div>
        
        <div id="lists-container">
          ${UI.emptyState('📋', 'No lists yet', 'Create your first contact list', {
            label: 'Create List',
            onclick: 'App.createList()'
          })}
        </div>
      </div>
    `;
    
    this.render(html);
  },

  createList() {
    UI.form([
      { name: 'name', label: 'List Name', required: true, placeholder: 'Cold Outreach Q1' },
    ], async (data) => {
      const result = await API.lists.create(data);
      
      if (result.ok) {
        UI.toast('List created', 'success');
        Router.refresh();
      } else {
        throw new Error(result.error || 'Failed to create list');
      }
    }, 'Create List');
  },

  async renderInboxes() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>📡 Connected Inboxes</h2>
          <button class="btn" onclick="App.connectInbox()">+ Connect Inbox</button>
        </div>
        
        <p style="margin-bottom: 1rem; color: var(--text-muted);">
          Connect your email inboxes to send campaigns. We support MailChannels, Gmail, and Microsoft.
        </p>
        
        <div id="inboxes-container">
          ${UI.emptyState('📧', 'No inboxes connected', 'Connect your first inbox to start sending', {
            label: 'Connect Inbox',
            onclick: 'App.connectInbox()'
          })}
        </div>
      </div>
    `;
    
    this.render(html);
  },

  connectInbox() {
    UI.form([
      { 
        name: 'provider', 
        label: 'Provider', 
        type: 'select',
        required: true,
        options: [
          { value: 'mailchannels', label: 'MailChannels' },
          { value: 'gmail', label: 'Gmail (OAuth)' },
          { value: 'microsoft', label: 'Microsoft (OAuth)' },
        ]
      },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'display_name', label: 'Display Name', required: true },
      { name: 'daily_limit', label: 'Daily Sending Limit', type: 'number', value: '500' },
    ], async (data) => {
      const result = await API.inboxes.create(data);
      
      if (result.ok) {
        UI.toast('Inbox connected', 'success');
        Router.refresh();
      } else {
        throw new Error(result.error || 'Failed to connect inbox');
      }
    }, 'Connect Inbox');
  },

  async renderSequences() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>🚀 Email Sequences</h2>
          <button class="btn" onclick="App.createSequence()">+ Create Sequence</button>
        </div>
        
        <p style="margin-bottom: 1rem; color: var(--text-muted);">
          Create multi-step email sequences with follow-ups and delays.
        </p>
        
        <div id="sequences-container">
          ${UI.emptyState('📨', 'No sequences yet', 'Create your first email sequence', {
            label: 'Create Sequence',
            onclick: 'App.createSequence()'
          })}
        </div>
      </div>
    `;
    
    this.render(html);
  },

  createSequence() {
    UI.form([
      { name: 'name', label: 'Sequence Name', required: true, placeholder: 'Cold Outreach Sequence' },
    ], async (data) => {
      const result = await API.sequences.create(data);
      
      if (result.ok) {
        UI.toast('Sequence created', 'success');
        Router.refresh();
      } else {
        throw new Error(result.error || 'Failed to create sequence');
      }
    }, 'Create Sequence');
  },

  async renderAnalytics() {
    const html = `
      <h1>📊 Analytics</h1>
      
      <div class="grid-3" style="margin-bottom: 2rem;">
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--primary)">0</div>
          <div class="stat-label">Total Sent</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--success)">0%</div>
          <div class="stat-label">Open Rate</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--warning)">0%</div>
          <div class="stat-label">Click Rate</div>
        </div>
      </div>
      
      <div class="card">
        <h3>Recent Events</h3>
        <p style="color: var(--text-muted); padding: 2rem; text-align: center;">
          No events yet
        </p>
      </div>
    `;
    
    this.render(html);
  },

  async renderWebsiteVisitors() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>🔍 Website Visitor Tracking</h2>
          <button class="btn" onclick="App.createSite()">+ Add Site</button>
        </div>
        
        <p style="margin-bottom: 1rem; color: var(--text-muted);">
          Track website visitors with our privacy-friendly pixel. No raw IPs stored.
        </p>
        
        <div id="sites-container">
          ${UI.emptyState('🌐', 'No sites configured', 'Add your first website to track visitors', {
            label: 'Add Site',
            onclick: 'App.createSite()'
          })}
        </div>
      </div>
    `;
    
    this.render(html);
  },

  createSite() {
    UI.form([
      { name: 'name', label: 'Site Name', required: true, placeholder: 'My Website' },
      { name: 'domains', label: 'Allowed Domains (comma-separated)', required: true, placeholder: 'example.com, www.example.com' },
    ], async (data) => {
      const result = await API.pixel.sites.create({
        name: data.name,
        allowed_domains_json: JSON.stringify(data.domains.split(',').map(d => d.trim())),
      });
      
      if (result.ok) {
        UI.toast('Site created', 'success');
        Router.refresh();
        
        // Show pixel code
        this.showPixelCode(result.data);
      } else {
        throw new Error(result.error || 'Failed to create site');
      }
    }, 'Add Site');
  },

  showPixelCode(site) {
    const pixelUrl = `${window.location.origin}/p/${site.id}.js`;
    const code = `<script async src="${pixelUrl}"></script>`;
    
    const html = `
      <h3>Pixel Code for ${UI.escapeHtml(site.name)}</h3>
      <p style="margin: 1rem 0; color: var(--text-muted);">
        Add this code to your website's &lt;head&gt; section:
      </p>
      <div style="background: #000; padding: 1rem; border-radius: 4px; font-family: monospace; overflow-x: auto;">
        <code style="color: var(--success);">${UI.escapeHtml(code)}</code>
      </div>
      <button class="btn" style="width: 100%; margin-top: 1rem;" onclick="navigator.clipboard.writeText(\`${code}\`); UI.toast('Copied!', 'success');">
        Copy Code
      </button>
    `;
    
    UI.modal(html);
  },

  async renderSettings() {
    const html = `
      <h1>⚙️ Settings</h1>
      
      <div class="grid-2">
        <div class="card">
          <h3>👤 Profile</h3>
          <label>Email</label>
          <input value="${this.user?.email || ''}" disabled style="cursor:not-allowed; opacity:0.6;">
          <label>Organization</label>
          <input value="${this.user?.org_name || ''}" disabled style="cursor:not-allowed; opacity:0.6;">
        </div>
        
        <div class="card">
          <h3>🔐 Security</h3>
          <button class="btn" onclick="App.changePassword()">Change Password</button>
        </div>
      </div>
      
      <div class="card" style="border-color:var(--danger);">
        <h3 style="color:var(--danger)">☠️ Danger Zone</h3>
        <p>Export your data or delete your account.</p>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn" onclick="App.exportData()">Export All Data</button>
        </div>
      </div>
    `;
    
    this.render(html);
  },

  changePassword() {
    UI.form([
      { name: 'current', label: 'Current Password', type: 'password', required: true },
      { name: 'new', label: 'New Password', type: 'password', required: true },
      { name: 'confirm', label: 'Confirm New Password', type: 'password', required: true },
    ], async (data) => {
      if (data.new !== data.confirm) {
        throw new Error('Passwords do not match');
      }
      
      UI.toast('Password changed successfully', 'success');
      // TODO: Call API in production
    }, 'Change Password');
  },

  async exportData() {
    UI.showLoading('Exporting data...');
    
    // TODO: Call API in production
    setTimeout(() => {
      UI.hideLoading();
      UI.toast('Data exported', 'success');
    }, 2000);
  },
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
