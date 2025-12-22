// API Client Module
// Handles all API communication with error handling and auth

const API_BASE = window.location.origin;

class API {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include' // Include cookies
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Auth
  static async signup(email, password, orgName) {
    return this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, orgName })
    });
  }

  static async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  static async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  static async getMe() {
    return this.request('/api/me');
  }

  // Contacts
  static async getContacts(page = 1, search = '') {
    const params = new URLSearchParams({ page, limit: 50 });
    if (search) params.set('search', search);
    return this.request(`/api/contacts?${params}`);
  }

  static async createContact(contact) {
    return this.request('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contact)
    });
  }

  static async updateContact(id, contact) {
    return this.request(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contact)
    });
  }

  static async deleteContact(id) {
    return this.request(`/api/contacts/${id}`, { method: 'DELETE' });
  }

  // Lists
  static async getLists() {
    return this.request('/api/lists');
  }

  static async createList(name, description) {
    return this.request('/api/lists', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  }

  static async getList(id) {
    return this.request(`/api/lists/${id}`);
  }

  static async importContacts(listId, csv) {
    return this.request(`/api/lists/${listId}/import`, {
      method: 'POST',
      body: JSON.stringify({ csv })
    });
  }

  // Inboxes
  static async getInboxes() {
    return this.request('/api/inboxes');
  }

  static async connectGoogle() {
    return this.request('/api/inboxes/connect/google', { method: 'POST' });
  }

  static async connectMicrosoft() {
    return this.request('/api/inboxes/connect/microsoft', { method: 'POST' });
  }

  static async updateInbox(id, settings) {
    return this.request(`/api/inboxes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  static async deleteInbox(id) {
    return this.request(`/api/inboxes/${id}`, { method: 'DELETE' });
  }

  // Sequences
  static async getSequences() {
    return this.request('/api/sequences');
  }

  static async createSequence(name) {
    return this.request('/api/sequences', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  static async getSequence(id) {
    return this.request(`/api/sequences/${id}`);
  }

  static async addSequenceStep(sequenceId, step) {
    return this.request(`/api/sequences/${sequenceId}/steps`, {
      method: 'POST',
      body: JSON.stringify(step)
    });
  }

  static async enrollInSequence(sequenceId, listId) {
    return this.request(`/api/sequences/${sequenceId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ list_id: listId })
    });
  }

  // Analytics
  static async getAnalytics(range = '7d') {
    return this.request(`/api/analytics/overview?range=${range}`);
  }

  static async getEvents(limit = 50) {
    return this.request(`/api/events?limit=${limit}`);
  }

  // Pixel Sites
  static async getSites() {
    return this.request('/api/pixel/sites');
  }

  static async createSite(name, allowedDomains) {
    return this.request('/api/pixel/sites', {
      method: 'POST',
      body: JSON.stringify({ name, allowed_domains: allowedDomains })
    });
  }

  static async getSiteStats(siteId, range = '24h') {
    return this.request(`/api/pixel/sites/${siteId}/stats?range=${range}`);
  }
}

// Export for use in other modules
window.API = API;
