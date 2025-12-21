// API Client for Nexus Email Sender
// Handles all communication with backend API

const API = {
    baseUrl: '/api',

    // Helper to make API requests
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Auth endpoints
    auth: {
        signup: (email, password) => API.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

        login: (email, password) => API.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

        logout: () => API.request('/auth/logout', {
            method: 'POST',
        }),

        me: () => API.request('/auth/me'),
    },

    // Contacts endpoints
    contacts: {
        list: () => API.request('/contacts'),
        
        get: (id) => API.request(`/contacts/${id}`),
        
        create: (data) => API.request('/contacts', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        
        update: (id, data) => API.request(`/contacts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        
        delete: (id) => API.request(`/contacts/${id}`, {
            method: 'DELETE',
        }),
        
        import: (csvData) => API.request('/contacts/import', {
            method: 'POST',
            body: JSON.stringify({ csvData }),
        }),
    },

    // Lists endpoints
    lists: {
        list: () => API.request('/lists'),
        
        get: (id) => API.request(`/lists/${id}`),
        
        create: (data) => API.request('/lists', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        
        update: (id, data) => API.request(`/lists/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        
        delete: (id) => API.request(`/lists/${id}`, {
            method: 'DELETE',
        }),
        
        addMembers: (id, contactIds) => API.request(`/lists/${id}/members`, {
            method: 'POST',
            body: JSON.stringify({ contactIds }),
        }),
        
        removeMembers: (id, contactIds) => API.request(`/lists/${id}/members`, {
            method: 'DELETE',
            body: JSON.stringify({ contactIds }),
        }),
    },

    // Senders endpoints
    senders: {
        list: () => API.request('/senders'),
        
        get: (id) => API.request(`/senders/${id}`),
        
        create: (data) => API.request('/senders', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        
        update: (id, data) => API.request(`/senders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        
        delete: (id) => API.request(`/senders/${id}`, {
            method: 'DELETE',
        }),
    },

    // Templates endpoints
    templates: {
        list: () => API.request('/templates'),
        
        get: (id) => API.request(`/templates/${id}`),
        
        create: (data) => API.request('/templates', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        
        update: (id, data) => API.request(`/templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        
        delete: (id) => API.request(`/templates/${id}`, {
            method: 'DELETE',
        }),
    },

    // Campaigns endpoints
    campaigns: {
        list: () => API.request('/campaigns'),
        
        get: (id) => API.request(`/campaigns/${id}`),
        
        create: (data) => API.request('/campaigns', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        
        update: (id, data) => API.request(`/campaigns/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        
        delete: (id) => API.request(`/campaigns/${id}`, {
            method: 'DELETE',
        }),
        
        send: (id, turnstileToken) => API.request(`/campaigns/${id}/send`, {
            method: 'POST',
            body: JSON.stringify({ turnstileToken }),
        }),
        
        batch: (id) => API.request(`/campaigns/${id}/batch`, {
            method: 'POST',
        }),
    },

    // Single send endpoint
    send: (data, turnstileToken) => API.request('/send', {
        method: 'POST',
        body: JSON.stringify({ ...data, turnstileToken }),
    }),

    // Events endpoint
    events: {
        list: (limit = 50) => API.request(`/events?limit=${limit}`),
    },

    // Health check
    health: () => API.request('/health'),
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
