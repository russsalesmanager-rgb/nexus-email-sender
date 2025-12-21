// UI Helper Module
// Toast notifications, modals, loaders

class UI {
  static toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    const colors = {
      success: 'var(--success)',
      error: 'var(--danger)',
      warning: 'var(--warning)',
      info: 'var(--primary)'
    };

    toast.style.borderLeftColor = colors[type] || colors.info;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  static showModal(title, content, buttons = []) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');

    if (!overlay || !modalContent) return;

    let html = `<h2>${title}</h2><div style="margin: 20px 0">${content}</div>`;

    if (buttons.length > 0) {
      html += '<div style="display: flex; gap: 10px; justify-content: flex-end">';
      buttons.forEach(btn => {
        const btnClass = btn.class || 'btn';
        html += `<button class="${btnClass}" onclick="(${btn.onclick.toString()})()">${btn.text}</button>`;
      });
      html += '</div>';
    }

    modalContent.innerHTML = html;
    overlay.style.display = 'flex';
  }

  static closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  static showLoader(message = 'Loading...') {
    const loader = document.createElement('div');
    loader.id = 'loader-overlay';
    loader.innerHTML = `
      <div style="background: var(--bg-panel); padding: 30px; border-radius: 8px; text-align: center">
        <div style="font-size: 24px; margin-bottom: 10px">⏳</div>
        <div>${message}</div>
      </div>
    `;
    loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999';
    document.body.appendChild(loader);
  }

  static hideLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.remove();
  }

  static confirmDialog(message, onConfirm) {
    this.showModal('Confirm', `<p>${message}</p>`, [
      {
        text: 'Cancel',
        class: 'btn',
        onclick: () => this.closeModal()
      },
      {
        text: 'Confirm',
        class: 'btn btn-danger',
        onclick: () => {
          this.closeModal();
          onConfirm();
        }
      }
    ]);
  }

  static promptDialog(title, message, onSubmit) {
    const inputId = 'prompt-input-' + Date.now();
    this.showModal(title, `
      <p>${message}</p>
      <input type="text" id="${inputId}" style="width: 100%; margin-top: 10px" />
    `, [
      {
        text: 'Cancel',
        class: 'btn',
        onclick: () => this.closeModal()
      },
      {
        text: 'Submit',
        class: 'btn btn-primary',
        onclick: () => {
          const value = document.getElementById(inputId).value;
          if (value.trim()) {
            this.closeModal();
            onSubmit(value.trim());
          }
        }
      }
    ]);

    // Focus input after render
    setTimeout(() => {
      const input = document.getElementById(inputId);
      if (input) input.focus();
    }, 100);
  }

  static formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  static formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other modules
window.UI = UI;
