// Page Modules for Nexus Email Sender
// Contains rendering logic for each page/view

// Dashboard Page
const DashboardPage = {
    async render(container) {
        UI.showLoading(container, 'Loading dashboard...');

        try {
            // Fetch dashboard data
            const [contactsRes, campaignsRes, eventsRes] = await Promise.all([
                API.contacts.list().catch(() => ({ ok: true, data: [] })),
                API.campaigns.list().catch(() => ({ ok: true, data: [] })),
                API.events.list(10).catch(() => ({ ok: true, data: [] })),
            ]);

            const contacts = contactsRes.data || [];
            const campaigns = campaignsRes.data || [];
            const events = eventsRes.data || [];
            
            const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
            const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);

            container.innerHTML = `
                <h1>Overview</h1>
                <div class="grid-4">
                    <div class="card stat-box">
                        <div class="stat-number" style="color:var(--primary)">${contacts.length}</div>
                        <div class="stat-label">Total Contacts</div>
                    </div>
                    <div class="card stat-box">
                        <div class="stat-number" style="color:var(--secondary)">${campaigns.length}</div>
                        <div class="stat-label">Total Campaigns</div>
                    </div>
                    <div class="card stat-box">
                        <div class="stat-number" style="color:var(--success)">${totalSent}</div>
                        <div class="stat-label">Emails Sent</div>
                    </div>
                    <div class="card stat-box">
                        <div class="stat-number" style="color:var(--warning)">${activeCampaigns}</div>
                        <div class="stat-label">Active Campaigns</div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="card">
                        <h3>📈 Recent Activity</h3>
                        <div style="max-height: 300px; overflow-y: auto;">
                            ${events.length === 0 ? '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No activity yet</p>' : ''}
                            ${events.map(e => `
                                <div style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <div style="font-size: 0.9rem;">${UI.sanitize(e.type)}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-muted);">${UI.formatDate(e.created_at)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="card">
                        <h3>🚀 Quick Actions</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <button class="btn" onclick="Router.nav('contacts')">+ Add Contacts</button>
                            <button class="btn btn-secondary" onclick="Router.nav('campaigns')">+ Create Campaign</button>
                            <button class="btn" onclick="Router.nav('templates')">+ New Template</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            UI.showError(container, 'Failed to load dashboard: ' + error.message);
        }
    },
};

// Contacts Page
const ContactsPage = {
    contacts: [],
    
    async render(container) {
        UI.showLoading(container, 'Loading contacts...');

        try {
            const response = await API.contacts.list();
            this.contacts = response.data || [];

            container.innerHTML = `
                <div class="card">
                    <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                        <h2>👥 Contacts Database</h2>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-secondary" onclick="ContactsPage.showImportModal()">📂 Import CSV</button>
                            <button class="btn" onclick="ContactsPage.showAddModal()">+ Add Contact</button>
                        </div>
                    </div>
                    ${this.contacts.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                            <p>No contacts yet. Add your first contact or import a CSV file.</p>
                        </div>
                    ` : `
                        <table>
                            <thead><tr><th>Name</th><th>Email</th><th>Tags</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${this.contacts.map(c => `
                                    <tr>
                                        <td>${UI.sanitize(c.first_name || '')} ${UI.sanitize(c.last_name || '')}</td>
                                        <td>${UI.sanitize(c.email)}</td>
                                        <td>${this.renderTags(c.tags_json)}</td>
                                        <td>
                                            <button class="btn btn-sm" onclick="ContactsPage.showEditModal('${c.id}')">Edit</button>
                                            <button class="btn btn-danger btn-sm" onclick="ContactsPage.deleteContact('${c.id}')">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div style="margin-top:10px; text-align:center; color:#666;">Total: ${this.contacts.length} contacts</div>
                    `}
                </div>
            `;
        } catch (error) {
            UI.showError(container, 'Failed to load contacts: ' + error.message);
        }
    },

    renderTags(tagsJson) {
        try {
            const tags = JSON.parse(tagsJson || '[]');
            if (tags.length === 0) return '-';
            return tags.map(tag => 
                `<span style="background:#333; padding:2px 8px; font-size:10px; border-radius:4px; margin-right: 4px;">${UI.sanitize(tag)}</span>`
            ).join('');
        } catch {
            return '-';
        }
    },

    showAddModal() {
        UI.modal(`
            <h3>Add New Contact</h3>
            <input id="contact-first-name" placeholder="First Name">
            <input id="contact-last-name" placeholder="Last Name">
            <input id="contact-email" placeholder="Email" type="email">
            <input id="contact-tags" placeholder="Tags (comma-separated)">
            <button class="btn" onclick="ContactsPage.saveContact()">Add Contact</button>
        `);
    },

    showEditModal(id) {
        const contact = this.contacts.find(c => c.id === id);
        if (!contact) return;

        const tags = JSON.parse(contact.tags_json || '[]').join(', ');

        UI.modal(`
            <h3>Edit Contact</h3>
            <input id="contact-first-name" placeholder="First Name" value="${UI.sanitize(contact.first_name || '')}">
            <input id="contact-last-name" placeholder="Last Name" value="${UI.sanitize(contact.last_name || '')}">
            <input id="contact-email" placeholder="Email" type="email" value="${UI.sanitize(contact.email)}">
            <input id="contact-tags" placeholder="Tags (comma-separated)" value="${UI.sanitize(tags)}">
            <button class="btn" onclick="ContactsPage.updateContact('${id}')">Update Contact</button>
        `);
    },

    async saveContact() {
        const firstName = $('#contact-first-name').value;
        const lastName = $('#contact-last-name').value;
        const email = $('#contact-email').value;
        const tagsStr = $('#contact-tags').value;

        if (!UI.validateEmail(email)) {
            UI.toast('Please enter a valid email', 'error');
            return;
        }

        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);

        try {
            await API.contacts.create({
                first_name: firstName,
                last_name: lastName,
                email,
                tags_json: JSON.stringify(tags),
            });

            UI.toast('Contact added successfully', 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to add contact: ' + error.message, 'error');
        }
    },

    async updateContact(id) {
        const firstName = $('#contact-first-name').value;
        const lastName = $('#contact-last-name').value;
        const email = $('#contact-email').value;
        const tagsStr = $('#contact-tags').value;

        if (!UI.validateEmail(email)) {
            UI.toast('Please enter a valid email', 'error');
            return;
        }

        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);

        try {
            await API.contacts.update(id, {
                first_name: firstName,
                last_name: lastName,
                email,
                tags_json: JSON.stringify(tags),
            });

            UI.toast('Contact updated successfully', 'success');
            UI.closeModal();
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to update contact: ' + error.message, 'error');
        }
    },

    async deleteContact(id) {
        if (!UI.confirm('Are you sure you want to delete this contact?')) return;

        try {
            await API.contacts.delete(id);
            UI.toast('Contact deleted successfully', 'success');
            Router.refresh();
        } catch (error) {
            UI.toast('Failed to delete contact: ' + error.message, 'error');
        }
    },

    showImportModal() {
        UI.modal(`
            <h3>Import Contacts from CSV</h3>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                Upload a CSV file with columns: email, first_name, last_name (optional)
            </p>
            <input type="file" id="csv-file" accept=".csv">
            <button class="btn" onclick="ContactsPage.importCSV()" style="margin-top: 1rem;">Import</button>
        `);
    },

    async importCSV() {
        const fileInput = $('#csv-file');
        if (!fileInput || !fileInput.files[0]) {
            UI.toast('Please select a CSV file', 'error');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const csvData = e.target.result;
                const response = await API.contacts.import(csvData);

                if (response.ok) {
                    UI.toast(`Imported ${response.data.count} contacts successfully`, 'success');
                    UI.closeModal();
                    Router.refresh();
                } else {
                    UI.toast(response.error || 'Import failed', 'error');
                }
            } catch (error) {
                UI.toast('Failed to import CSV: ' + error.message, 'error');
            }
        };

        reader.readAsText(file);
    },
};

// Campaigns Page (simplified version)
const CampaignsPage = {
    async render(container) {
        UI.showLoading(container, 'Loading campaigns...');

        try {
            const response = await API.campaigns.list();
            const campaigns = response.data || [];

            container.innerHTML = `
                <div class="card">
                    <div style="display:flex; justify-content:space-between;">
                        <h2>🚀 Email Campaigns</h2>
                        <button class="btn" onclick="CampaignsPage.showCreateModal()">+ New Campaign</button>
                    </div>
                    ${campaigns.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                            <p>No campaigns yet. Create your first campaign to get started.</p>
                        </div>
                    ` : `
                        <div class="grid-3" style="margin-top:1rem;">
                            ${campaigns.map(c => `
                                <div class="card" style="margin: 0;">
                                    <h4 style="color:var(--primary)">${UI.sanitize(c.name)}</h4>
                                    <div style="font-size:0.8rem; margin:0.5rem 0;">
                                        Status: <span style="color:${c.status === 'active' ? 'var(--success)' : '#888'}">${c.status.toUpperCase()}</span>
                                    </div>
                                    <div style="font-size:0.8rem;">Sent: ${c.sent_count || 0}</div>
                                    <button class="btn btn-sm" style="margin-top:10px;" onclick="CampaignsPage.viewCampaign('${c.id}')">View</button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            `;
        } catch (error) {
            UI.showError(container, 'Failed to load campaigns: ' + error.message);
        }
    },

    showCreateModal() {
        UI.toast('Campaign creation will be available after setting up senders and templates', 'info');
        // Full implementation will be added in Phase 7
    },

    viewCampaign(id) {
        UI.toast('Campaign details view coming soon', 'info');
        // Full implementation will be added in Phase 7
    },
};

// Settings Page  
const SettingsPage = {
    async render(container) {
        container.innerHTML = `
            <h1>⚙️ Settings</h1>
            <div class="card">
                <h3>👤 Account</h3>
                <p>Email: ${UI.sanitize(App.user?.email || 'N/A')}</p>
                <button class="btn btn-danger" onclick="Auth.logout()">Logout</button>
            </div>
            <div class="card">
                <h3>ℹ️ Application Info</h3>
                <p>Nexus Email Sender v1.0</p>
                <p>Built for Cloudflare Pages + Workers</p>
            </div>
        `;
    },
};

// Register all routes
Router.register('dashboard', (container) => DashboardPage.render(container));
Router.register('contacts', (container) => ContactsPage.render(container));
Router.register('campaigns', (container) => CampaignsPage.render(container));
Router.register('settings', (container) => SettingsPage.render(container));

// Placeholder routes for other pages
Router.register('senders', (container) => {
    container.innerHTML = '<h1>📡 Senders</h1><p>Coming soon...</p>';
});

Router.register('templates', (container) => {
    container.innerHTML = '<h1>📝 Templates</h1><p>Coming soon...</p>';
});

Router.register('lists', (container) => {
    container.innerHTML = '<h1>📋 Lists</h1><p>Coming soon...</p>';
});
