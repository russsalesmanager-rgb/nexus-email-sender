// UI utilities for NEXUS Email Sender
// Handles toasts, modals, loading states, and form validation

const UI = {
  // Toast notifications
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    const colors = {
      success: 'var(--success)',
      error: 'var(--danger)',
      warning: 'var(--warning)',
      info: 'var(--primary)',
    };
    
    toast.style.borderLeftColor = colors[type] || colors.info;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  },
  
  createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
  },
  
  // Modal dialog
  modal(content, onClose = null) {
    // Remove existing modal if any
    this.closeModal();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.id = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'btn btn-secondary';
    closeBtn.style.float = 'right';
    closeBtn.onclick = () => {
      this.closeModal();
      if (onClose) onClose();
    };
    
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = content;
    
    modal.appendChild(closeBtn);
    modal.appendChild(contentDiv);
    overlay.appendChild(modal);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal();
        if (onClose) onClose();
      }
    });
    
    document.body.appendChild(overlay);
  },
  
  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.remove();
    }
  },
  
  // Loading state for buttons
  setLoading(button, loading = true) {
    if (loading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = '⏳ Loading...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  },
  
  // Form validation
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  validateRequired(value) {
    return value && value.trim().length > 0;
  },
  
  // Get form data as object
  getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    
    const data = {};
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      if (input.id) {
        data[input.id] = input.value;
      }
    });
    
    return data;
  },
  
  // Show/hide elements
  show(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'block';
  },
  
  hide(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
  },
  
  // Confirm dialog
  confirm(message, onConfirm, onCancel = null) {
    this.modal(`
      <h3 style="margin-bottom: 1rem;">${message}</h3>
      <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
        <button class="btn btn-secondary" onclick="UI.closeModal(); ${onCancel ? onCancel.toString() + '()' : ''}">Cancel</button>
        <button class="btn" onclick="UI.closeModal(); ${onConfirm.toString()}()">Confirm</button>
      </div>
    `);
  },
  
  // Show page loading state
  showPageLoader() {
    const loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    loader.innerHTML = '<div style="color: var(--primary); font-size: 2rem;">⏳ Loading...</div>';
    document.body.appendChild(loader);
  },
  
  hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.remove();
  },
};

// Helper function to get element by ID
function $(id) {
  return document.getElementById(id);
}

// Helper function to get elements by selector
function $$(selector) {
  return document.querySelectorAll(selector);
}
