/**
 * API Client for Nexus Email Sender
 * Handles all HTTP requests to the backend with authentication
 */

class API {
    static baseURL = '/api';

    /**
     * Make an authenticated API request
     */
    static async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'same-origin' // Include cookies
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    static async signup(email, password) {
        return this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    static async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    static async logout() {
        return this.request('/auth/logout', {
            method: 'POST'
        });
    }

    static async getMe() {
        return this.request('/me');
    }

    // Contacts
    static async getContacts() {
        return this.request('/contacts');
    }

    static async createContact(data) {
        return this.request('/contacts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async updateContact(id, data) {
        return this.request(`/contacts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async deleteContact(id) {
        return this.request(`/contacts/${id}`, {
            method: 'DELETE'
        });
    }

    // Lists
    static async getLists() {
        return this.request('/lists');
    }

    static async createList(data) {
        return this.request('/lists', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async updateList(id, data) {
        return this.request(`/lists/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async deleteList(id) {
        return this.request(`/lists/${id}`, {
            method: 'DELETE'
        });
    }

    static async importCSV(listId, csvContent) {
        return this.request(`/lists/${listId}/import-csv`, {
            method: 'POST',
            body: JSON.stringify({ csv: csvContent })
        });
    }

    static async addContactToList(listId, contactId) {
        return this.request(`/lists/${listId}/add-contact`, {
            method: 'POST',
            body: JSON.stringify({ contactId })
        });
    }

    // Templates
    static async getTemplates() {
        return this.request('/templates');
    }

    static async createTemplate(data) {
        return this.request('/templates', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async updateTemplate(id, data) {
        return this.request(`/templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async deleteTemplate(id) {
        return this.request(`/templates/${id}`, {
            method: 'DELETE'
        });
    }

    // Senders
    static async getSenders() {
        return this.request('/senders');
    }

    static async createSender(data) {
        return this.request('/senders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async updateSender(id, data) {
        return this.request(`/senders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async deleteSender(id) {
        return this.request(`/senders/${id}`, {
            method: 'DELETE'
        });
    }

    // Campaigns
    static async getCampaigns() {
        return this.request('/campaigns');
    }

    static async createCampaign(data) {
        return this.request('/campaigns', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async updateCampaign(id, data) {
        return this.request(`/campaigns/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async deleteCampaign(id) {
        return this.request(`/campaigns/${id}`, {
            method: 'DELETE'
        });
    }

    static async queueCampaign(id) {
        return this.request(`/campaigns/${id}/queue`, {
            method: 'POST'
        });
    }

    static async sendCampaignBatch(id, turnstileToken) {
        return this.request(`/campaigns/${id}/send`, {
            method: 'POST',
            body: JSON.stringify({ turnstileToken })
        });
    }

    static async getCampaignStatus(id) {
        return this.request(`/campaigns/${id}/status`);
    }

    // Send
    static async sendTestEmail(data, turnstileToken) {
        return this.request('/send', {
            method: 'POST',
            body: JSON.stringify({ ...data, turnstileToken })
        });
    }

    // Health
    static async health() {
        return this.request('/health');
    }
}

// Make API available globally
window.API = API;
