/**
 * UI Utilities for Nexus Email Sender
 * Toast notifications, modals, loading states, and DOM helpers
 */

class UI {
    /**
     * Show a toast notification
     */
    static toast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'toast';
        div.textContent = msg;
        
        const colors = {
            error: 'var(--danger)',
            success: 'var(--success)',
            warning: 'var(--warning)',
            info: 'var(--primary)'
        };
        
        div.style.borderLeftColor = colors[type] || colors.info;
        container.appendChild(div);
        
        setTimeout(() => div.remove(), 3000);
    }

    /**
     * Show a modal with custom content
     */
    static modal(html, onClose) {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        
        if (!overlay || !content) return;
        
        content.innerHTML = html;
        overlay.style.display = 'flex';
        
        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.closeModal();
                if (onClose) onClose();
            }
        };
    }

    /**
     * Close the modal
     */
    static closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Show loading state on a button
     */
    static setLoading(button, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    /**
     * Confirm dialog
     */
    static confirm(message) {
        return window.confirm(message);
    }

    /**
     * Prompt dialog
     */
    static prompt(message, defaultValue = '') {
        return window.prompt(message, defaultValue);
    }

    /**
     * Format date for display
     */
    static formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }

    /**
     * Format number with commas
     */
    static formatNumber(num) {
        return num.toLocaleString();
    }

    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate a simple UUID
     */
    static uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Simple form validation
     */
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Parse CSV text into array of objects
     */
    static parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            rows.push(row);
        }

        return rows;
    }

    /**
     * Handle API errors consistently
     */
    static async handleApiCall(apiCall, successMessage) {
        try {
            const result = await apiCall();
            if (successMessage) {
                this.toast(successMessage, 'success');
            }
            return result;
        } catch (error) {
            this.toast(error.message || 'An error occurred', 'error');
            throw error;
        }
    }
}

// Make UI available globally
window.UI = UI;
