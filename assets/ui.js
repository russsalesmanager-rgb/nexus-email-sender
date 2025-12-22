/**
 * UI Helper utilities
 * Toasts, modals, loading states, and other UI components
 */

const UI = {
  /**
   * Show a toast notification
   */
  toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // Set border color based on type
    const colors = {
      info: 'var(--primary)',
      success: 'var(--success)',
      error: 'var(--danger)',
      warning: 'var(--warning)',
    };
    toast.style.borderLeftColor = colors[type] || colors.info;
    
    container.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
      toast.remove();
    }, duration);
  },

  /**
   * Show a modal dialog
   */
  modal(content, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    
    if (!overlay || !modalContent) return;
    
    modalContent.innerHTML = content;
    overlay.style.display = 'flex';
    
    // Close on overlay click (unless disabled)
    if (!options.disableBackdropClose) {
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          this.closeModal();
        }
      };
    }
    
    // Close on ESC key (unless disabled)
    if (!options.disableEscClose) {
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeModal();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }
  },

  /**
   * Close the modal
   */
  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },

  /**
   * Confirm dialog
   */
  async confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const content = `
        <h3>${title}</h3>
        <p style="margin: 1rem 0;">${message}</p>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button class="btn" onclick="UI._confirmResolve(false)">Cancel</button>
          <button class="btn btn-danger" onclick="UI._confirmResolve(true)">Confirm</button>
        </div>
      `;
      
      this._confirmCallback = resolve;
      this.modal(content, { disableBackdropClose: true });
    });
  },

  _confirmResolve(value) {
    if (this._confirmCallback) {
      this._confirmCallback(value);
      this._confirmCallback = null;
    }
    this.closeModal();
  },

  /**
   * Show loading state
   */
  showLoading(message = 'Loading...') {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    
    if (!overlay || !modalContent) return;
    
    modalContent.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div class="spinner"></div>
        <p style="margin-top: 1rem;">${message}</p>
      </div>
    `;
    overlay.style.display = 'flex';
    overlay.onclick = null; // Disable closing while loading
  },

  /**
   * Hide loading state
   */
  hideLoading() {
    this.closeModal();
  },

  /**
   * Render a simple form
   */
  form(fields, onSubmit, submitLabel = 'Submit') {
    const formHtml = fields.map(field => {
      const { name, label, type = 'text', placeholder = '', required = false, value = '' } = field;
      
      if (type === 'textarea') {
        return `
          <label>${label}${required ? ' *' : ''}</label>
          <textarea id="form-${name}" placeholder="${placeholder}" ${required ? 'required' : ''}>${value}</textarea>
        `;
      } else if (type === 'select') {
        const options = field.options || [];
        return `
          <label>${label}${required ? ' *' : ''}</label>
          <select id="form-${name}" ${required ? 'required' : ''}>
            ${options.map(opt => `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`).join('')}
          </select>
        `;
      } else {
        return `
          <label>${label}${required ? ' *' : ''}</label>
          <input type="${type}" id="form-${name}" placeholder="${placeholder}" value="${value}" ${required ? 'required' : ''}>
        `;
      }
    }).join('');
    
    const content = `
      <form id="ui-form">
        ${formHtml}
        <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">${submitLabel}</button>
      </form>
    `;
    
    this.modal(content);
    
    // Handle form submission
    document.getElementById('ui-form').onsubmit = async (e) => {
      e.preventDefault();
      
      const data = {};
      fields.forEach(field => {
        const input = document.getElementById(`form-${field.name}`);
        if (input) {
          data[field.name] = input.value;
        }
      });
      
      try {
        await onSubmit(data);
        this.closeModal();
      } catch (error) {
        this.toast(error.message, 'error');
      }
    };
  },

  /**
   * Utility: Format date
   */
  formatDate(date, format = 'short') {
    if (!date) return '-';
    
    const d = new Date(date);
    
    if (format === 'short') {
      return d.toLocaleDateString();
    } else if (format === 'long') {
      return d.toLocaleString();
    } else if (format === 'relative') {
      const now = Date.now();
      const diff = now - d.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (seconds < 60) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    }
    
    return d.toISOString();
  },

  /**
   * Utility: Format number with commas
   */
  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
  },

  /**
   * Utility: Truncate text
   */
  truncate(text, length = 50) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  },

  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Render empty state
   */
  emptyState(icon, title, message, action = null) {
    return `
      <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
        <div style="font-size: 4rem; margin-bottom: 1rem;">${icon}</div>
        <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">${title}</h3>
        <p>${message}</p>
        ${action ? `<button class="btn" style="margin-top: 1rem;" onclick="${action.onclick}">${action.label}</button>` : ''}
      </div>
    `;
  },
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UI;
}
