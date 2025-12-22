/**
 * API client for Nexus backend
 * Handles fetch requests, auth tokens, and error handling
 */

const API = {
  baseURL: window.location.origin,
  
  /**
   * Generic fetch wrapper with auth handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'same-origin', // Include cookies
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      // Handle auth errors
      if (response.status === 401) {
        // Redirect to login
        window.location.hash = '#/login';
        return { ok: false, error: 'Unauthorized' };
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return { ok: false, error: error.message };
    }
  },

  // Auth endpoints
  auth: {
    signup: (email, password, orgName) => 
      API.request('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, org_name: orgName }),
      }),
    
    login: (email, password) =>
      API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    
    logout: () =>
      API.request('/api/auth/logout', { method: 'POST' }),
    
    me: () =>
      API.request('/api/me'),
  },

  // Contacts endpoints
  contacts: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/contacts?${query}`);
    },
    
    get: (id) =>
      API.request(`/api/contacts/${id}`),
    
    create: (data) =>
      API.request('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id, data) =>
      API.request(`/api/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id) =>
      API.request(`/api/contacts/${id}`, { method: 'DELETE' }),
  },

  // Lists endpoints
  lists: {
    list: () => API.request('/api/lists'),
    
    get: (id) => API.request(`/api/lists/${id}`),
    
    create: (data) =>
      API.request('/api/lists', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id, data) =>
      API.request(`/api/lists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id) =>
      API.request(`/api/lists/${id}`, { method: 'DELETE' }),
    
    import: (id, csvData) =>
      API.request(`/api/lists/${id}/import`, {
        method: 'POST',
        body: JSON.stringify({ csv: csvData }),
      }),
    
    members: (id) =>
      API.request(`/api/lists/${id}/members`),
  },

  // Inboxes endpoints
  inboxes: {
    list: () => API.request('/api/inboxes'),
    
    get: (id) => API.request(`/api/inboxes/${id}`),
    
    create: (data) =>
      API.request('/api/inboxes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id, data) =>
      API.request(`/api/inboxes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id) =>
      API.request(`/api/inboxes/${id}`, { method: 'DELETE' }),
  },

  // Sequences endpoints
  sequences: {
    list: () => API.request('/api/sequences'),
    
    get: (id) => API.request(`/api/sequences/${id}`),
    
    create: (data) =>
      API.request('/api/sequences', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id, data) =>
      API.request(`/api/sequences/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id) =>
      API.request(`/api/sequences/${id}`, { method: 'DELETE' }),
    
    enroll: (id, listId) =>
      API.request(`/api/sequences/${id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ list_id: listId }),
      }),
    
    status: (id) =>
      API.request(`/api/sequences/${id}/status`),
    
    steps: {
      list: (sequenceId) =>
        API.request(`/api/sequences/${sequenceId}/steps`),
      
      create: (sequenceId, data) =>
        API.request(`/api/sequences/${sequenceId}/steps`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      
      update: (sequenceId, stepId, data) =>
        API.request(`/api/sequences/${sequenceId}/steps/${stepId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      
      delete: (sequenceId, stepId) =>
        API.request(`/api/sequences/${sequenceId}/steps/${stepId}`, {
          method: 'DELETE',
        }),
    },
  },

  // Analytics endpoints
  analytics: {
    overview: (range = '7d') =>
      API.request(`/api/analytics/overview?range=${range}`),
    
    sequence: (id, range = '7d') =>
      API.request(`/api/analytics/sequence/${id}?range=${range}`),
  },

  // Events endpoints
  events: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/events?${query}`);
    },
  },

  // Website visitor pixel endpoints
  pixel: {
    sites: {
      list: () => API.request('/api/pixel/sites'),
      
      get: (id) => API.request(`/api/pixel/sites/${id}`),
      
      create: (data) =>
        API.request('/api/pixel/sites', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      
      update: (id, data) =>
        API.request(`/api/pixel/sites/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      
      delete: (id) =>
        API.request(`/api/pixel/sites/${id}`, { method: 'DELETE' }),
      
      stats: (id, range = '24h') =>
        API.request(`/api/pixel/sites/${id}/stats?range=${range}`),
    },
  },

  // Health check
  health: () => API.request('/api/health'),
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
