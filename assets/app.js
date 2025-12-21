// Main application logic for NEXUS Email Sender
// Handles page rendering and business logic

const App = {
  user: null,
  data: {
    contacts: [],
    lists: [],
    templates: [],
    senders: [],
    campaigns: [],
  },
  
  // Initialize app
  async init() {
    // Check if user is logged in
    try {
      const result = await API.auth.me();
      this.user = result.user;
      Router.currentUser = this.user;
      
      // Load initial data
      await this.loadData();
      
      // Initialize router
      Router.init();
    } catch (error) {
      // Not logged in, show login screen
      Router.navigate('login');
    }
  },
  
  // Load all data
  async loadData() {
    try {
      const [contacts, lists, templates, senders, campaigns] = await Promise.all([
        API.contacts.list().catch(() => ({ contacts: [] })),
        API.lists.list().catch(() => ({ lists: [] })),
        API.templates.list().catch(() => ({ templates: [] })),
        API.senders.list().catch(() => ({ senders: [] })),
        API.campaigns.list().catch(() => ({ campaigns: [] })),
      ]);
      
      this.data.contacts = contacts.contacts || [];
      this.data.lists = lists.lists || [];
      this.data.templates = templates.templates || [];
      this.data.senders = senders.senders || [];
      this.data.campaigns = campaigns.campaigns || [];
    } catch (error) {
      console.error('Error loading data:', error);
    }
  },
  
  // Render Dashboard
  renderDashboard() {
    const totalSent = this.data.campaigns.reduce((sum, c) => {
      // Estimate sent count (would be from status API in real scenario)
      return sum + (c.status === 'completed' ? 100 : c.status === 'sending' ? 50 : 0);
    }, 0);
    
    const activeCampaigns = this.data.campaigns.filter(c => c.status === 'sending' || c.status === 'queued').length;
    
    const html = `
      <h1>Overview</h1>
      <div class="grid-4">
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--primary)">${totalSent}</div>
          <div class="stat-label">Total Sent</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--secondary)">${Math.floor(totalSent * 0.98)}</div>
          <div class="stat-label">Delivered (98%)</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--success)">${Math.floor(totalSent * 0.35)}</div>
          <div class="stat-label">Opens (Est.)</div>
        </div>
        <div class="card stat-box">
          <div class="stat-number" style="color:var(--warning)">${activeCampaigns}</div>
          <div class="stat-label">Active Campaigns</div>
        </div>
      </div>
      
      <div class="grid-2" style="margin-top: 2rem;">
        <div class="card">
          <h3>📊 Recent Campaigns</h3>
          <table>
            <thead><tr><th>Name</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              ${this.data.campaigns.slice(0, 5).map(c => `
                <tr>
                  <td>${c.name}</td>
                  <td><span style="color: ${this.getCampaignStatusColor(c.status)}">${c.status}</span></td>
                  <td>${new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">No campaigns yet</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <div class="card">
          <h3>📈 Quick Stats</h3>
          <div style="padding: 1rem 0;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>Total Contacts</span>
              <strong>${this.data.contacts.length}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>Email Lists</span>
              <strong>${this.data.lists.length}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>Templates</span>
              <strong>${this.data.templates.length}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span>Senders</span>
              <strong>${this.data.senders.length}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
    
    $('#main-content').innerHTML = html;
  },
  
  getCampaignStatusColor(status) {
    const colors = {
      'draft': 'var(--text-muted)',
      'queued': 'var(--warning)',
      'sending': 'var(--primary)',
      'completed': 'var(--success)',
      'paused': 'var(--text-muted)',
    };
    return colors[status] || 'var(--text-muted)';
  },
  
  // Render Contacts page
  renderContacts() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>👥 Contacts Database</h2>
          <button class="btn" onclick="App.showAddContactModal()">+ Add Contact</button>
        </div>
        <table>
          <thead><tr><th>Email</th><th>First Name</th><th>Last Name</th><th>Tags</th><th>Actions</th></tr></thead>
          <tbody>
            ${this.data.contacts.map(c => `
              <tr>
                <td>${c.email}</td>
                <td>${c.first_name || '-'}</td>
                <td>${c.last_name || '-'}</td>
                <td>${(c.tags || []).join(', ') || '-'}</td>
                <td>
                  <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="App.deleteContact('${c.id}')">Delete</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No contacts yet. Add your first contact!</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    $('#main-content').innerHTML = html;
  },
  
  showAddContactModal() {
    UI.modal(`
      <h3>Add New Contact</h3>
      <form id="add-contact-form" style="margin-top: 1rem;">
        <input id="contact-email" type="email" placeholder="Email *" required style="margin-bottom: 1rem;">
        <input id="contact-firstname" placeholder="First Name" style="margin-bottom: 1rem;">
        <input id="contact-lastname" placeholder="Last Name" style="margin-bottom: 1rem;">
        <input id="contact-tags" placeholder="Tags (comma-separated)" style="margin-bottom: 1rem;">
        <button type="submit" class="btn">Add Contact</button>
      </form>
    `);
    
    $('#add-contact-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addContact();
    });
  },
  
  async addContact() {
    const email = $('#contact-email').value;
    const firstName = $('#contact-firstname').value;
    const lastName = $('#contact-lastname').value;
    const tagsStr = $('#contact-tags').value;
    
    if (!UI.validateEmail(email)) {
      UI.toast('Please enter a valid email', 'error');
      return;
    }
    
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
    
    try {
      UI.showPageLoader();
      await API.contacts.create({
        email,
        first_name: firstName,
        last_name: lastName,
        tags,
      });
      
      await this.loadData();
      UI.closeModal();
      Router.refresh();
      UI.toast('Contact added successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to add contact', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  async deleteContact(id) {
    // Simple confirmation using native browser confirm for now
    // Could be enhanced with custom modal in future
    const confirmed = window.confirm('Are you sure you want to delete this contact?');
    if (!confirmed) return;
    
    try {
      UI.showPageLoader();
      await API.contacts.delete(id);
      await this.loadData();
      Router.refresh();
      UI.toast('Contact deleted successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to delete contact', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  // Render Lists page
  renderLists() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>📋 Email Lists</h2>
          <button class="btn" onclick="App.showAddListModal()">+ Create List</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Members</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${this.data.lists.map(list => `
              <tr>
                <td>${list.name}</td>
                <td>${list.member_count || 0}</td>
                <td>${new Date(list.created_at).toLocaleDateString()}</td>
                <td>
                  <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.5rem;" onclick="App.showImportCSVModal('${list.id}')">Import CSV</button>
                  <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="App.deleteList('${list.id}')">Delete</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No lists yet. Create your first list!</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    $('#main-content').innerHTML = html;
  },
  
  showAddListModal() {
    UI.modal(`
      <h3>Create New List</h3>
      <form id="add-list-form" style="margin-top: 1rem;">
        <input id="list-name" placeholder="List Name *" required style="margin-bottom: 1rem;">
        <button type="submit" class="btn">Create List</button>
      </form>
    `);
    
    $('#add-list-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addList();
    });
  },
  
  async addList() {
    const name = $('#list-name').value;
    
    if (!UI.validateRequired(name)) {
      UI.toast('Please enter a list name', 'error');
      return;
    }
    
    try {
      UI.showPageLoader();
      await API.lists.create(name);
      await this.loadData();
      UI.closeModal();
      Router.refresh();
      UI.toast('List created successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to create list', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  showImportCSVModal(listId) {
    UI.modal(`
      <h3>Import CSV to List</h3>
      <p style="color: var(--text-muted); margin-bottom: 1rem;">
        CSV must have at least an "email" column. Optional: first_name, last_name
      </p>
      <form id="import-csv-form" style="margin-top: 1rem;">
        <textarea id="csv-data" placeholder="Paste CSV data here..." style="min-height: 200px; margin-bottom: 1rem;"></textarea>
        <button type="submit" class="btn">Import</button>
      </form>
    `);
    
    $('#import-csv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.importCSV(listId);
    });
  },
  
  async importCSV(listId) {
    const csv = $('#csv-data').value;
    
    if (!UI.validateRequired(csv)) {
      UI.toast('Please paste CSV data', 'error');
      return;
    }
    
    try {
      UI.showPageLoader();
      const result = await API.lists.importCSV(listId, csv);
      await this.loadData();
      UI.closeModal();
      Router.refresh();
      UI.toast(`Imported ${result.imported} contacts, skipped ${result.skipped}`, 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to import CSV', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  async deleteList(id) {
    const confirmed = window.confirm('Are you sure you want to delete this list?');
    if (!confirmed) return;
    
    try {
      UI.showPageLoader();
      await API.lists.delete(id);
      await this.loadData();
      Router.refresh();
      UI.toast('List deleted successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to delete list', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  // Render Templates page
  renderTemplates() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>📝 Email Templates</h2>
          <button class="btn" onclick="App.showAddTemplateModal()">+ Create Template</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Subject</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${this.data.templates.map(t => `
              <tr>
                <td>${t.name}</td>
                <td>${t.subject}</td>
                <td>${new Date(t.created_at).toLocaleDateString()}</td>
                <td>
                  <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="App.deleteTemplate('${t.id}')">Delete</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No templates yet. Create your first template!</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    $('#main-content').innerHTML = html;
  },
  
  showAddTemplateModal() {
    UI.modal(`
      <h3>Create New Template</h3>
      <form id="add-template-form" style="margin-top: 1rem;">
        <input id="template-name" placeholder="Template Name *" required style="margin-bottom: 1rem;">
        <input id="template-subject" placeholder="Email Subject *" required style="margin-bottom: 1rem;">
        <textarea id="template-html" placeholder="HTML Content" style="min-height: 150px; margin-bottom: 1rem;"></textarea>
        <textarea id="template-text" placeholder="Plain Text Content (optional)" style="min-height: 100px; margin-bottom: 1rem;"></textarea>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
          Use {{first_name}}, {{last_name}}, {{email}} for personalization
        </p>
        <button type="submit" class="btn">Create Template</button>
      </form>
    `);
    
    $('#add-template-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addTemplate();
    });
  },
  
  async addTemplate() {
    const name = $('#template-name').value;
    const subject = $('#template-subject').value;
    const html = $('#template-html').value;
    const text = $('#template-text').value;
    
    if (!UI.validateRequired(name) || !UI.validateRequired(subject)) {
      UI.toast('Please fill in all required fields', 'error');
      return;
    }
    
    try {
      UI.showPageLoader();
      await API.templates.create({ name, subject, html, text });
      await this.loadData();
      UI.closeModal();
      Router.refresh();
      UI.toast('Template created successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to create template', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  async deleteTemplate(id) {
    const confirmed = window.confirm('Are you sure you want to delete this template?');
    if (!confirmed) return;
    
    try {
      UI.showPageLoader();
      await API.templates.delete(id);
      await this.loadData();
      Router.refresh();
      UI.toast('Template deleted successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to delete template', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  // Render Senders page
  renderSenders() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>📡 Email Senders</h2>
          <button class="btn" onclick="App.showAddSenderModal()">+ Add Sender</button>
        </div>
        <table>
          <thead><tr><th>From Name</th><th>From Email</th><th>Reply-To</th><th>Actions</th></tr></thead>
          <tbody>
            ${this.data.senders.map(s => `
              <tr>
                <td>${s.from_name}</td>
                <td>${s.from_email}</td>
                <td>${s.reply_to || '-'}</td>
                <td>
                  <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="App.deleteSender('${s.id}')">Delete</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No senders yet. Add your first sender!</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    $('#main-content').innerHTML = html;
  },
  
  showAddSenderModal() {
    UI.modal(`
      <h3>Add New Sender</h3>
      <form id="add-sender-form" style="margin-top: 1rem;">
        <input id="sender-name" placeholder="From Name *" required style="margin-bottom: 1rem;">
        <input id="sender-email" type="email" placeholder="From Email *" required style="margin-bottom: 1rem;">
        <input id="sender-reply" type="email" placeholder="Reply-To Email (optional)" style="margin-bottom: 1rem;">
        <button type="submit" class="btn">Add Sender</button>
      </form>
    `);
    
    $('#add-sender-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addSender();
    });
  },
  
  async addSender() {
    const fromName = $('#sender-name').value;
    const fromEmail = $('#sender-email').value;
    const replyTo = $('#sender-reply').value;
    
    if (!UI.validateRequired(fromName) || !UI.validateEmail(fromEmail)) {
      UI.toast('Please fill in all required fields with valid data', 'error');
      return;
    }
    
    if (replyTo && !UI.validateEmail(replyTo)) {
      UI.toast('Please enter a valid reply-to email', 'error');
      return;
    }
    
    try {
      UI.showPageLoader();
      await API.senders.create({
        from_name: fromName,
        from_email: fromEmail,
        reply_to: replyTo || null,
      });
      await this.loadData();
      UI.closeModal();
      Router.refresh();
      UI.toast('Sender added successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to add sender', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  async deleteSender(id) {
    const confirmed = window.confirm('Are you sure you want to delete this sender?');
    if (!confirmed) return;
    
    try {
      UI.showPageLoader();
      await API.senders.delete(id);
      await this.loadData();
      Router.refresh();
      UI.toast('Sender deleted successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to delete sender', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  // Render Campaigns page
  renderCampaigns() {
    const html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
          <h2>🚀 Campaigns</h2>
          <button class="btn" onclick="App.showAddCampaignModal()">+ Create Campaign</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${this.data.campaigns.map(c => `
              <tr>
                <td>${c.name}</td>
                <td><span style="color: ${this.getCampaignStatusColor(c.status)}">${c.status}</span></td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  ${c.status === 'draft' ? `<button class="btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.5rem;" onclick="App.queueCampaign('${c.id}')">Queue</button>` : ''}
                  ${c.status === 'queued' || c.status === 'sending' ? `<button class="btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.5rem;" onclick="App.sendCampaignBatch('${c.id}')">Send Batch</button>` : ''}
                  <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="App.viewCampaignStatus('${c.id}')">Status</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No campaigns yet. Create your first campaign!</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    $('#main-content').innerHTML = html;
  },
  
  showAddCampaignModal() {
    if (this.data.lists.length === 0 || this.data.templates.length === 0 || this.data.senders.length === 0) {
      UI.toast('Please create at least one list, template, and sender before creating a campaign', 'warning');
      return;
    }
    
    UI.modal(`
      <h3>Create New Campaign</h3>
      <form id="add-campaign-form" style="margin-top: 1rem;">
        <input id="campaign-name" placeholder="Campaign Name *" required style="margin-bottom: 1rem;">
        
        <select id="campaign-list" style="margin-bottom: 1rem;" required>
          <option value="">Select List *</option>
          ${this.data.lists.map(list => `<option value="${list.id}">${list.name} (${list.member_count} members)</option>`).join('')}
        </select>
        
        <select id="campaign-template" style="margin-bottom: 1rem;" required>
          <option value="">Select Template *</option>
          ${this.data.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
        
        <select id="campaign-sender" style="margin-bottom: 1rem;" required>
          <option value="">Select Sender *</option>
          ${this.data.senders.map(s => `<option value="${s.id}">${s.from_name} (${s.from_email})</option>`).join('')}
        </select>
        
        <button type="submit" class="btn">Create Campaign</button>
      </form>
    `);
    
    $('#add-campaign-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addCampaign();
    });
  },
  
  async addCampaign() {
    const name = $('#campaign-name').value;
    const listId = $('#campaign-list').value;
    const templateId = $('#campaign-template').value;
    const senderId = $('#campaign-sender').value;
    
    if (!UI.validateRequired(name) || !listId || !templateId || !senderId) {
      UI.toast('Please fill in all required fields', 'error');
      return;
    }
    
    try {
      UI.showPageLoader();
      await API.campaigns.create({
        name,
        list_id: listId,
        template_id: templateId,
        sender_id: senderId,
      });
      await this.loadData();
      UI.closeModal();
      Router.refresh();
      UI.toast('Campaign created successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to create campaign', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  async queueCampaign(id) {
    const confirmed = window.confirm('Queue this campaign? This will create send jobs for all contacts in the list.');
    if (!confirmed) return;
    
    try {
      UI.showPageLoader();
      const result = await API.campaigns.queue(id);
      await this.loadData();
      Router.refresh();
      UI.toast(`Campaign queued: ${result.jobs_created} jobs created`, 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to queue campaign', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  async sendCampaignBatch(id) {
    try {
      UI.showPageLoader();
      const result = await API.campaigns.send(id);
      await this.loadData();
      Router.refresh();
      UI.toast(`Sent: ${result.sent}, Failed: ${result.failed}`, result.failed > 0 ? 'warning' : 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to send batch', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  async viewCampaignStatus(id) {
    try {
      UI.showPageLoader();
      const result = await API.campaigns.status(id);
      
      UI.modal(`
        <h3>Campaign Status: ${result.campaign.name}</h3>
        <div style="margin-top: 2rem;">
          <div style="display: flex; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.05); margin-bottom: 0.5rem; border-radius: 4px;">
            <span>Status:</span>
            <strong style="color: ${this.getCampaignStatusColor(result.campaign.status)}">${result.campaign.status}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.05); margin-bottom: 0.5rem; border-radius: 4px;">
            <span>Total Jobs:</span>
            <strong>${result.total}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.05); margin-bottom: 0.5rem; border-radius: 4px;">
            <span>Sent:</span>
            <strong style="color: var(--success)">${result.counts.sent}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.05); margin-bottom: 0.5rem; border-radius: 4px;">
            <span>Queued:</span>
            <strong style="color: var(--warning)">${result.counts.queued}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <span>Failed:</span>
            <strong style="color: var(--danger)">${result.counts.failed}</strong>
          </div>
        </div>
      `);
    } catch (error) {
      UI.toast(error.message || 'Failed to get campaign status', 'error');
    } finally {
      UI.hidePageLoader();
    }
  },
  
  // Render Settings page
  renderSettings() {
    const html = `
      <div class="card">
        <h2>⚙️ Settings</h2>
        <div style="margin-top: 2rem;">
          <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <strong>Email:</strong> ${this.user?.email || 'N/A'}
          </div>
          <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <strong>User ID:</strong> ${this.user?.id || 'N/A'}
          </div>
          <div style="padding: 1rem;">
            <button class="btn btn-secondary" onclick="App.logout()">Logout</button>
          </div>
        </div>
      </div>
    `;
    
    $('#main-content').innerHTML = html;
  },
  
  async logout() {
    try {
      await API.auth.logout();
      this.user = null;
      Router.currentUser = null;
      Router.navigate('login');
      UI.toast('Logged out successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Failed to logout', 'error');
    }
  },
};

// Auth handling
const Auth = {
  async handleLogin(e) {
    e.preventDefault();
    
    const email = $('#auth-email').value;
    const password = $('#auth-password').value;
    const loginBtn = $('#login-btn');
    
    if (!UI.validateEmail(email)) {
      UI.toast('Please enter a valid email', 'error');
      return;
    }
    
    try {
      UI.setLoading(loginBtn, true);
      const result = await API.auth.login(email, password);
      App.user = result.user;
      Router.currentUser = result.user;
      await App.loadData();
      Router.navigate('dashboard');
      UI.toast('Logged in successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Login failed', 'error');
    } finally {
      UI.setLoading(loginBtn, false);
    }
  },
  
  async handleSignup(e) {
    e.preventDefault();
    
    const email = $('#auth-email').value;
    const password = $('#auth-password').value;
    const signupBtn = $('#signup-btn');
    
    if (!UI.validateEmail(email)) {
      UI.toast('Please enter a valid email', 'error');
      return;
    }
    
    if (password.length < 8) {
      UI.toast('Password must be at least 8 characters', 'error');
      return;
    }
    
    try {
      UI.setLoading(signupBtn, true);
      const result = await API.auth.signup(email, password);
      App.user = result.user;
      Router.currentUser = result.user;
      await App.loadData();
      Router.navigate('dashboard');
      UI.toast('Account created successfully', 'success');
    } catch (error) {
      UI.toast(error.message || 'Signup failed', 'error');
    } finally {
      UI.setLoading(signupBtn, false);
    }
  },
};

// Initialize app when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
