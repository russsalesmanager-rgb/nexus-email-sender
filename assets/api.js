// API wrapper for NEXUS Email Sender
// Handles all API calls with auth and error handling

const API = {
  baseUrl: '/api',
  
  // Helper to make authenticated requests
  async request(method, path, data = null, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies
    };
    
    if (data) {
      config.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, config);
      const result = await response.json();
      
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Request failed');
      }
      
      return result.data;
    } catch (error) {
      console.error(`API Error [${method} ${path}]:`, error);
      throw error;
    }
  },
  
  // Auth endpoints
  auth: {
    async signup(email, password) {
      return API.request('POST', '/auth/signup', { email, password });
    },
    
    async login(email, password) {
      return API.request('POST', '/auth/login', { email, password });
    },
    
    async logout() {
      return API.request('POST', '/auth/logout');
    },
    
    async me() {
      return API.request('GET', '/me');
    },
  },
  
  // Contacts endpoints
  contacts: {
    async list() {
      return API.request('GET', '/contacts');
    },
    
    async create(contact) {
      return API.request('POST', '/contacts', contact);
    },
    
    async get(id) {
      return API.request('GET', `/contacts/${id}`);
    },
    
    async update(id, updates) {
      return API.request('PUT', `/contacts/${id}`, updates);
    },
    
    async delete(id) {
      return API.request('DELETE', `/contacts/${id}`);
    },
  },
  
  // Lists endpoints
  lists: {
    async list() {
      return API.request('GET', '/lists');
    },
    
    async create(name) {
      return API.request('POST', '/lists', { name });
    },
    
    async get(id) {
      return API.request('GET', `/lists/${id}`);
    },
    
    async update(id, name) {
      return API.request('PUT', `/lists/${id}`, { name });
    },
    
    async delete(id) {
      return API.request('DELETE', `/lists/${id}`);
    },
    
    async importCSV(id, csv) {
      return API.request('POST', `/lists/${id}/import`, { csv });
    },
  },
  
  // Templates endpoints
  templates: {
    async list() {
      return API.request('GET', '/templates');
    },
    
    async create(template) {
      return API.request('POST', '/templates', template);
    },
    
    async get(id) {
      return API.request('GET', `/templates/${id}`);
    },
    
    async update(id, updates) {
      return API.request('PUT', `/templates/${id}`, updates);
    },
    
    async delete(id) {
      return API.request('DELETE', `/templates/${id}`);
    },
  },
  
  // Senders endpoints
  senders: {
    async list() {
      return API.request('GET', '/senders');
    },
    
    async create(sender) {
      return API.request('POST', '/senders', sender);
    },
    
    async get(id) {
      return API.request('GET', `/senders/${id}`);
    },
    
    async update(id, updates) {
      return API.request('PUT', `/senders/${id}`, updates);
    },
    
    async delete(id) {
      return API.request('DELETE', `/senders/${id}`);
    },
  },
  
  // Campaigns endpoints
  campaigns: {
    async list() {
      return API.request('GET', '/campaigns');
    },
    
    async create(campaign) {
      return API.request('POST', '/campaigns', campaign);
    },
    
    async get(id) {
      return API.request('GET', `/campaigns/${id}`);
    },
    
    async update(id, updates) {
      return API.request('PUT', `/campaigns/${id}`, updates);
    },
    
    async delete(id) {
      return API.request('DELETE', `/campaigns/${id}`);
    },
    
    async queue(id) {
      return API.request('POST', `/campaigns/${id}/queue`);
    },
    
    async send(id, turnstileToken = null) {
      return API.request('POST', `/campaigns/${id}/send`, { turnstile_token: turnstileToken });
    },
    
    async status(id) {
      return API.request('GET', `/campaigns/${id}/status`);
    },
  },
  
  // Send endpoint
  async sendEmail(params) {
    return this.request('POST', '/send', params);
  },
  
  // Health check
  async health() {
    return this.request('GET', '/health');
  },
};
