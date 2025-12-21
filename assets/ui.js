// UI Helper Module for Nexus Email Sender
// Handles toasts, modals, and other UI components

const UI = {
    // Toast notifications
    toast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'toast';
        div.innerHTML = msg;
        
        const colors = {
            error: 'var(--danger)',
            success: 'var(--success)',
            warning: 'var(--warning)',
            info: 'var(--primary)'
        };
        
        div.style.borderLeftColor = colors[type] || colors.info;
        container.appendChild(div);
        
        setTimeout(() => div.remove(), 3000);
    },

    // Modal handling
    modal(html) {
        const modalContent = document.getElementById('modal-content');
        const modalOverlay = document.getElementById('modal-overlay');
        
        if (!modalContent || !modalOverlay) return;
        
        modalContent.innerHTML = html;
        modalOverlay.style.display = 'flex';
        
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                this.closeModal();
            }
        };
    },

    closeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    },

    // Loading state
    showLoading(element, message = 'Loading...') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            element.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">${message}</div>`;
        }
    },

    // Error state
    showError(element, message = 'An error occurred') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            element.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--danger);">${message}</div>`;
        }
    },

    // Form validation
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePassword(password) {
        return password && password.length >= 6;
    },

    validateRequired(value) {
        return value && value.trim().length > 0;
    },

    // Sanitize HTML to prevent XSS
    sanitize(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },

    // Format date
    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    },

    // Confirm dialog
    confirm(message) {
        return window.confirm(message);
    },
};

// Helper function for element selection
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// UUID generator
const uuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UI, $, $$, uuid };
}
