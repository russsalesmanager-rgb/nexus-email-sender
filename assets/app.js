/**
 * Nexus Email Sender - Main Application
 * Bootstrap and page wiring
 */

// --- DOM HELPERS ---
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// --- AUTH MODULE ---
class Auth {
    static currentUser = null;

    static async login() {
        const email = $('#login-email').value;
        const password = $('#login-pass').value;
        const btn = event.target;

        if (!email || !password) {
            UI.toast('Please enter email and password', 'error');
            return;
        }

        UI.setLoading(btn, true);

        try {
            const result = await API.login(email, password);
            this.currentUser = result.user;
            this.showApp();
        } catch (error) {
            UI.toast('Login failed: ' + error.message, 'error');
        } finally {
            UI.setLoading(btn, false);
        }
    }

    static async signup() {
        const email = UI.prompt('Enter email for new account:');
        if (!email || !UI.validateEmail(email)) {
            UI.toast('Invalid email', 'error');
            return;
        }

        const password = UI.prompt('Enter password (min 8 characters):');
        if (!password || password.length < 8) {
            UI.toast('Password must be at least 8 characters', 'error');
            return;
        }

        try {
            await API.signup(email, password);
            UI.toast('Account created! Please login.', 'success');
        } catch (error) {
            UI.toast('Signup failed: ' + error.message, 'error');
        }
    }

    static async logout() {
        if (!UI.confirm('Are you sure you want to logout?')) return;

        try {
            await API.logout();
            this.currentUser = null;
            location.reload();
        } catch (error) {
            UI.toast('Logout failed: ' + error.message, 'error');
        }
    }

    static async check() {
        try {
            const result = await API.getMe();
            this.currentUser = result.user;
            this.showApp();
        } catch (error) {
            // Not authenticated, show login screen
            this.showLogin();
        }
    }

    static showApp() {
        $('#auth-screen').style.display = 'none';
        $('#app').style.display = 'flex';
        setTimeout(() => $('#app').style.opacity = 1, 100);
        Router.init();
        Router.nav(Router.current);
    }

    static showLogin() {
        $('#auth-screen').style.display = 'flex';
        $('#app').style.display = 'none';
    }
}

// --- DATA STORE (For stats and temporary data) ---
class DataStore {
    static stats = { sent: 0, delivered: 0, opened: 0, clicked: 0 };

    static async refreshStats() {
        try {
            // Calculate stats from campaigns
            const campaigns = await API.getCampaigns();
            let totalSent = 0;
            
            for (const campaign of campaigns) {
                const status = await API.getCampaignStatus(campaign.id);
                totalSent += status.sent || 0;
            }
            
            this.stats.sent = totalSent;
            this.stats.delivered = Math.floor(totalSent * 0.98);
            this.stats.opened = Math.floor(totalSent * 0.35);
            this.stats.clicked = Math.floor(totalSent * 0.08);
        } catch (error) {
            console.error('Failed to refresh stats:', error);
        }
    }
}

// --- CONTACT MANAGER ---
class ContactManager {
    static async render() {
        try {
            const contacts = await API.getContacts();
            const lists = await API.getLists();
            
            return `
                <h1>👥 Contacts & Lists</h1>
                
                <div class="grid-2">
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3>Contacts (${contacts.length})</h3>
                            <button class="btn" onclick="ContactManager.showAddContactModal()">+ Add Contact</button>
                        </div>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Name</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${contacts.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No contacts yet</td></tr>' : ''}
                                ${contacts.map(c => `
                                    <tr>
                                        <td>${UI.escapeHtml(c.email)}</td>
                                        <td>${UI.escapeHtml(c.first_name || '')} ${UI.escapeHtml(c.last_name || '')}</td>
                                        <td>
                                            <button class="btn-sm" onclick="ContactManager.editContact('${c.id}')">Edit</button>
                                            <button class="btn-sm" onclick="ContactManager.deleteContact('${c.id}')">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3>Lists (${lists.length})</h3>
                            <button class="btn" onclick="ContactManager.showAddListModal()">+ Create List</button>
                        </div>
                        
                        <div style="max-height: 500px; overflow-y: auto;">
                            ${lists.length === 0 ? '<p style="text-align:center; color: var(--text-muted);">No lists yet</p>' : ''}
                            ${lists.map(list => `
                                <div class="card" style="background: var(--bg-panel-light); margin-bottom: 1rem;">
                                    <h4>${UI.escapeHtml(list.name)}</h4>
                                    <div style="margin-top: 0.5rem;">
                                        <button class="btn-sm" onclick="ContactManager.showImportCSVModal('${list.id}')">Import CSV</button>
                                        <button class="btn-sm" onclick="ContactManager.deleteList('${list.id}')">Delete</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `<h1>Error loading contacts</h1><p>${error.message}</p>`;
        }
    }

    static showAddContactModal() {
        UI.modal(`
            <h2>Add Contact</h2>
            <input type="email" id="contact-email" placeholder="Email" style="width:100%; margin-bottom:1rem;">
            <input type="text" id="contact-firstname" placeholder="First Name" style="width:100%; margin-bottom:1rem;">
            <input type="text" id="contact-lastname" placeholder="Last Name" style="width:100%; margin-bottom:1rem;">
            <button class="btn" onclick="ContactManager.saveContact()">Add Contact</button>
        `);
    }

    static async saveContact() {
        const email = $('#contact-email').value;
        const firstName = $('#contact-firstname').value;
        const lastName = $('#contact-lastname').value;

        if (!email || !UI.validateEmail(email)) {
            UI.toast('Valid email required', 'error');
            return;
        }

        try {
            await API.createContact({
                email,
                first_name: firstName,
                last_name: lastName
            });
            
            UI.toast('Contact added successfully', 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to add contact: ' + error.message, 'error');
        }
    }

    static async deleteContact(id) {
        if (!UI.confirm('Delete this contact?')) return;

        try {
            await API.deleteContact(id);
            UI.toast('Contact deleted', 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to delete: ' + error.message, 'error');
        }
    }

    static showAddListModal() {
        UI.modal(`
            <h2>Create List</h2>
            <input type="text" id="list-name" placeholder="List Name" style="width:100%; margin-bottom:1rem;">
            <button class="btn" onclick="ContactManager.saveList()">Create List</button>
        `);
    }

    static async saveList() {
        const name = $('#list-name').value;

        if (!name) {
            UI.toast('List name required', 'error');
            return;
        }

        try {
            await API.createList({ name });
            UI.toast('List created successfully', 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to create list: ' + error.message, 'error');
        }
    }

    static async deleteList(id) {
        if (!UI.confirm('Delete this list?')) return;

        try {
            await API.deleteList(id);
            UI.toast('List deleted', 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to delete: ' + error.message, 'error');
        }
    }

    static showImportCSVModal(listId) {
        UI.modal(`
            <h2>Import CSV</h2>
            <p style="color: var(--text-muted); margin-bottom: 1rem;">
                CSV format: email, first_name, last_name (headers required)
            </p>
            <textarea id="csv-content" placeholder="Paste CSV content here..." 
                style="width:100%; height:300px; margin-bottom:1rem;"></textarea>
            <button class="btn" onclick="ContactManager.importCSV('${listId}')">Import</button>
        `);
    }

    static async importCSV(listId) {
        const csvContent = $('#csv-content').value;

        if (!csvContent) {
            UI.toast('Please paste CSV content', 'error');
            return;
        }

        try {
            const result = await API.importCSV(listId, csvContent);
            UI.toast(`Imported ${result.imported} contacts`, 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Import failed: ' + error.message, 'error');
        }
    }
}

// --- TEMPLATE MANAGER ---
class TemplateManager {
    static async render() {
        try {
            const templates = await API.getTemplates();
            
            return `
                <h1>📝 Email Templates</h1>
                
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>Templates (${templates.length})</h3>
                        <button class="btn" onclick="TemplateManager.showAddTemplateModal()">+ Create Template</button>
                    </div>
                    
                    <div class="grid-2">
                        ${templates.length === 0 ? '<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted);">No templates yet</p>' : ''}
                        ${templates.map(t => `
                            <div class="card" style="background: var(--bg-panel-light);">
                                <h4>${UI.escapeHtml(t.name)}</h4>
                                <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.5rem 0;">
                                    Subject: ${UI.escapeHtml(t.subject)}
                                </p>
                                <div style="margin-top: 1rem;">
                                    <button class="btn-sm" onclick="TemplateManager.editTemplate('${t.id}')">Edit</button>
                                    <button class="btn-sm" onclick="TemplateManager.deleteTemplate('${t.id}')">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            return `<h1>Error loading templates</h1><p>${error.message}</p>`;
        }
    }

    static showAddTemplateModal() {
        UI.modal(`
            <h2>Create Template</h2>
            <input type="text" id="template-name" placeholder="Template Name" style="width:100%; margin-bottom:1rem;">
            <input type="text" id="template-subject" placeholder="Email Subject" style="width:100%; margin-bottom:1rem;">
            <textarea id="template-html" placeholder="HTML Content (use {{first_name}}, {{email}} for variables)" 
                style="width:100%; height:200px; margin-bottom:1rem;"></textarea>
            <textarea id="template-text" placeholder="Plain Text Content (optional)" 
                style="width:100%; height:100px; margin-bottom:1rem;"></textarea>
            <button class="btn" onclick="TemplateManager.saveTemplate()">Save Template</button>
        `);
    }

    static async saveTemplate() {
        const name = $('#template-name').value;
        const subject = $('#template-subject').value;
        const html = $('#template-html').value;
        const text = $('#template-text').value;

        if (!name || !subject || !html) {
            UI.toast('Name, subject and HTML content required', 'error');
            return;
        }

        try {
            await API.createTemplate({ name, subject, html, text });
            UI.toast('Template created successfully', 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to create template: ' + error.message, 'error');
        }
    }

    static async deleteTemplate(id) {
        if (!UI.confirm('Delete this template?')) return;

        try {
            await API.deleteTemplate(id);
            UI.toast('Template deleted', 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to delete: ' + error.message, 'error');
        }
    }
}

// --- SENDER MANAGER ---
class SenderManager {
    static async render() {
        try {
            const senders = await API.getSenders();
            
            return `
                <h1>📡 Sender Identities</h1>
                
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>Senders (${senders.length})</h3>
                        <button class="btn" onclick="SenderManager.showAddSenderModal()">+ Add Sender</button>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>From Name</th>
                                <th>From Email</th>
                                <th>Reply To</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${senders.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No senders yet</td></tr>' : ''}
                            ${senders.map(s => `
                                <tr>
                                    <td>${UI.escapeHtml(s.from_name)}</td>
                                    <td>${UI.escapeHtml(s.from_email)}</td>
                                    <td>${UI.escapeHtml(s.reply_to || '-')}</td>
                                    <td>
                                        <button class="btn-sm" onclick="SenderManager.editSender('${s.id}')">Edit</button>
                                        <button class="btn-sm" onclick="SenderManager.deleteSender('${s.id}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="card" style="margin-top: 2rem; background: rgba(188, 19, 254, 0.1); border-color: var(--secondary);">
                    <h3 style="color: var(--secondary);">ℹ️ Email Sending</h3>
                    <p style="color: var(--text-muted);">
                        This app uses MailChannels for email delivery. Make sure your sender email addresses 
                        are verified and authorized to send from your domain.
                    </p>
                </div>
            `;
        } catch (error) {
            return `<h1>Error loading senders</h1><p>${error.message}</p>`;
        }
    }

    static showAddSenderModal() {
        UI.modal(`
            <h2>Add Sender Identity</h2>
            <input type="text" id="sender-name" placeholder="From Name (e.g., John Doe)" style="width:100%; margin-bottom:1rem;">
            <input type="email" id="sender-email" placeholder="From Email" style="width:100%; margin-bottom:1rem;">
            <input type="email" id="sender-reply" placeholder="Reply To (optional)" style="width:100%; margin-bottom:1rem;">
            <button class="btn" onclick="SenderManager.saveSender()">Add Sender</button>
        `);
    }

    static async saveSender() {
        const fromName = $('#sender-name').value;
        const fromEmail = $('#sender-email').value;
        const replyTo = $('#sender-reply').value;

        if (!fromName || !fromEmail || !UI.validateEmail(fromEmail)) {
            UI.toast('Valid from name and email required', 'error');
            return;
        }

        if (replyTo && !UI.validateEmail(replyTo)) {
            UI.toast('Reply-to email is invalid', 'error');
            return;
        }

        try {
            await API.createSender({
                from_name: fromName,
                from_email: fromEmail,
                reply_to: replyTo || null
            });
            
            UI.toast('Sender added successfully', 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to add sender: ' + error.message, 'error');
        }
    }

    static async deleteSender(id) {
        if (!UI.confirm('Delete this sender?')) return;

        try {
            await API.deleteSender(id);
            UI.toast('Sender deleted', 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to delete: ' + error.message, 'error');
        }
    }
}

// --- CAMPAIGN MANAGER ---
class CampaignManager {
    static async render() {
        try {
            const campaigns = await API.getCampaigns();
            
            return `
                <h1>🚀 Campaigns</h1>
                
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>Campaigns (${campaigns.length})</h3>
                        <button class="btn" onclick="CampaignManager.showCreateCampaignModal()">+ Create Campaign</button>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${campaigns.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No campaigns yet</td></tr>' : ''}
                            ${campaigns.map(c => `
                                <tr>
                                    <td>${UI.escapeHtml(c.name)}</td>
                                    <td><span style="color: ${c.status === 'active' ? 'var(--success)' : 'var(--text-muted)'}">${c.status}</span></td>
                                    <td id="campaign-progress-${c.id}">
                                        <button class="btn-sm" onclick="CampaignManager.loadStatus('${c.id}')">Load Status</button>
                                    </td>
                                    <td>
                                        ${c.status === 'draft' ? `
                                            <button class="btn-sm" onclick="CampaignManager.queueCampaign('${c.id}')">Queue</button>
                                        ` : ''}
                                        ${c.status === 'queued' ? `
                                            <button class="btn-sm" onclick="CampaignManager.sendBatch('${c.id}')">Send Batch</button>
                                        ` : ''}
                                        <button class="btn-sm" onclick="CampaignManager.deleteCampaign('${c.id}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            return `<h1>Error loading campaigns</h1><p>${error.message}</p>`;
        }
    }

    static async showCreateCampaignModal() {
        try {
            const [senders, templates, lists] = await Promise.all([
                API.getSenders(),
                API.getTemplates(),
                API.getLists()
            ]);

            UI.modal(`
                <h2>Create Campaign</h2>
                <input type="text" id="campaign-name" placeholder="Campaign Name" style="width:100%; margin-bottom:1rem;">
                
                <select id="campaign-sender" style="width:100%; margin-bottom:1rem;">
                    <option value="">Select Sender</option>
                    ${senders.map(s => `<option value="${s.id}">${UI.escapeHtml(s.from_name)} &lt;${UI.escapeHtml(s.from_email)}&gt;</option>`).join('')}
                </select>
                
                <select id="campaign-template" style="width:100%; margin-bottom:1rem;">
                    <option value="">Select Template</option>
                    ${templates.map(t => `<option value="${t.id}">${UI.escapeHtml(t.name)}</option>`).join('')}
                </select>
                
                <select id="campaign-list" style="width:100%; margin-bottom:1rem;">
                    <option value="">Select List</option>
                    ${lists.map(l => `<option value="${l.id}">${UI.escapeHtml(l.name)}</option>`).join('')}
                </select>
                
                <button class="btn" onclick="CampaignManager.saveCampaign()">Create Campaign</button>
            `);
        } catch (error) {
            UI.toast('Failed to load resources: ' + error.message, 'error');
        }
    }

    static async saveCampaign() {
        const name = $('#campaign-name').value;
        const senderId = $('#campaign-sender').value;
        const templateId = $('#campaign-template').value;
        const listId = $('#campaign-list').value;

        if (!name || !senderId || !templateId || !listId) {
            UI.toast('All fields are required', 'error');
            return;
        }

        try {
            await API.createCampaign({
                name,
                sender_id: senderId,
                template_id: templateId,
                list_id: listId,
                status: 'draft'
            });
            
            UI.toast('Campaign created successfully', 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to create campaign: ' + error.message, 'error');
        }
    }

    static async queueCampaign(id) {
        if (!UI.confirm('Queue this campaign for sending?')) return;

        try {
            const result = await API.queueCampaign(id);
            UI.toast(`Queued ${result.queued} emails`, 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to queue: ' + error.message, 'error');
        }
    }

    static async sendBatch(id) {
        if (!UI.confirm('Send next batch of emails?')) return;

        // TODO: Add Turnstile token here
        const turnstileToken = 'bypass-for-now'; // In production, get from Turnstile widget

        try {
            const result = await API.sendCampaignBatch(id, turnstileToken);
            UI.toast(`Sent ${result.sent} emails`, 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to send: ' + error.message, 'error');
        }
    }

    static async loadStatus(id) {
        try {
            const status = await API.getCampaignStatus(id);
            const cell = document.getElementById(`campaign-progress-${id}`);
            if (cell) {
                cell.innerHTML = `${status.sent || 0} / ${status.total || 0} sent`;
            }
        } catch (error) {
            UI.toast('Failed to load status: ' + error.message, 'error');
        }
    }

    static async deleteCampaign(id) {
        if (!UI.confirm('Delete this campaign?')) return;

        try {
            await API.deleteCampaign(id);
            UI.toast('Campaign deleted', 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to delete: ' + error.message, 'error');
        }
    }
}

// --- SETTINGS MANAGER ---
class SettingsManager {
    static render() {
        return `
            <h1>⚙️ Settings</h1>
            
            <div class="card">
                <h3>Application Settings</h3>
                <p style="color: var(--text-muted);">
                    Settings are managed through environment variables in Cloudflare Pages.
                </p>
                
                <div style="margin-top: 2rem;">
                    <h4 style="color: var(--primary);">Required Environment Variables:</h4>
                    <ul style="color: var(--text-muted); margin-left: 2rem; margin-top: 1rem; line-height: 1.8;">
                        <li><code>TURNSTILE_SECRET</code> - Cloudflare Turnstile secret key</li>
                        <li><code>TURNSTILE_SITEKEY</code> - Cloudflare Turnstile site key</li>
                        <li><code>APP_ORIGIN</code> - Application URL (e.g., https://nexus.mailverge.info)</li>
                        <li><code>MAIL_FROM_DEFAULT</code> - Default sender email address</li>
                    </ul>
                </div>
            </div>
            
            <div class="card" style="margin-top: 2rem;">
                <h3>Account</h3>
                <p style="color: var(--text-muted);">
                    Logged in as: <strong>${Auth.currentUser?.email || 'Unknown'}</strong>
                </p>
                <button class="btn" style="margin-top: 1rem; background: var(--danger);" onclick="Auth.logout()">Logout</button>
            </div>
        `;
    }
}

// --- DASHBOARD VIEW ---
function renderDashboard() {
    const stats = DataStore.stats;
    
    return `
        <h1>📊 Dashboard</h1>
        <div class="grid-4">
            <div class="card stat-box">
                <div class="stat-number" style="color:var(--primary)">${UI.formatNumber(stats.sent)}</div>
                <div class="stat-label">Total Sent</div>
            </div>
            <div class="card stat-box">
                <div class="stat-number" style="color:var(--secondary)">${UI.formatNumber(stats.delivered)}</div>
                <div class="stat-label">Delivered (98%)</div>
            </div>
            <div class="card stat-box">
                <div class="stat-number" style="color:var(--success)">${UI.formatNumber(stats.opened)}</div>
                <div class="stat-label">Opens (Est.)</div>
            </div>
            <div class="card stat-box">
                <div class="stat-number" style="color:var(--warning)">${UI.formatNumber(stats.clicked)}</div>
                <div class="stat-label">Clicks (Est.)</div>
            </div>
        </div>

        <div class="card" style="margin-top: 2rem;">
            <h3>📈 Performance Overview</h3>
            <div style="height:200px; display:flex; align-items:end; gap:5px; padding-top:20px; border-bottom:1px solid #333;">
                ${Array(20).fill(0).map(() => {
                    const h = Math.random() * 80 + 10;
                    return `<div style="flex:1; background:linear-gradient(to top, var(--primary), transparent); height:${h}%; border-radius:2px 2px 0 0;"></div>`;
                }).join('')}
            </div>
        </div>
        
        <div class="card" style="margin-top: 2rem;">
            <h3>🚀 Quick Actions</h3>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn" onclick="Router.nav('contacts')">Add Contacts</button>
                <button class="btn" onclick="Router.nav('campaigns')">Create Campaign</button>
                <button class="btn" onclick="Router.nav('senders')">Setup Sender</button>
            </div>
        </div>
    `;
}

// --- APPLICATION BOOTSTRAP ---
function initBackgroundAnimation() {
    const canvas = document.getElementById('canvas-bg');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00f3ff';
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// --- REGISTER ROUTES ---
Router.register('dashboard', renderDashboard);
Router.register('contacts', () => ContactManager.render());
Router.register('templates', () => TemplateManager.render());
Router.register('senders', () => SenderManager.render());
Router.register('campaigns', () => CampaignManager.render());
Router.register('settings', () => SettingsManager.render());

// Placeholder for AI/Integrations pages (not implemented yet)
Router.register('ai', () => '<h1>🤖 AI Command</h1><p>Coming soon...</p>');
Router.register('integrations', () => '<h1>🔗 Integrations</h1><p>Coming soon...</p>');

// --- INIT ---
window.addEventListener('load', async () => {
    initBackgroundAnimation();
    await DataStore.refreshStats();
    await Auth.check();
});

// Refresh stats periodically
setInterval(() => {
    if (Auth.currentUser && Router.current === 'dashboard') {
        DataStore.refreshStats().then(() => Router.refresh());
    }
}, 30000); // Every 30 seconds

// Make classes available globally
window.Auth = Auth;
window.ContactManager = ContactManager;
window.TemplateManager = TemplateManager;
window.SenderManager = SenderManager;
window.CampaignManager = CampaignManager;
window.SettingsManager = SettingsManager;
