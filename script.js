document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const pages = document.querySelectorAll('.page-content');
    const authBtn = document.getElementById('discord-auth-btn');
    const userStatusText = document.getElementById('user-status-text');
    const publishBox = document.getElementById('publish-box');
    const fufuAdminBox = document.getElementById('fufu-admin-box');
    const membersGrid = document.getElementById('members-grid');
    const adminUserSelect = document.getElementById('admin-user-select');
    const adminVerifyBtn = document.getElementById('admin-verify-btn');

    let currentUser = null;
    let globalVerifiedUsers = []; 

    // Navigation Onglets
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active-page'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-target');
            document.getElementById(target).classList.add('active-page');

            if (target === 'page-members') {
                loadMembers();
            }
        });
    });

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    }

    // Chargement sécurisé de la DB sans bloquer le reste du script
    async function initDatabaseAndStatus() {
        try {
            const res = await fetch('/api/videos');
            if (res.ok) {
                const data = await res.json();
                if (data && data.verifiedUsers) globalVerifiedUsers = data.verifiedUsers;
            }
        } catch (e) {
            console.warn("La DB KV n'a pas encore répondu, affichage par défaut :", e);
        }

        // Gestion de l'affichage de la session utilisateur
        const userCookie = getCookie('usms_user');
        if (userCookie) {
            try {
                currentUser = JSON.parse(userCookie);
                const isFufu = currentUser.username.toLowerCase() === 'fufuofficial_';
                const isVerifiedInDb = globalVerifiedUsers.includes(currentUser.username.toLowerCase());
                
                // Coche bleue si Fufu OU si validé en BDD KV
                const displayBadge = isFufu || isVerifiedInDb;
                let checkmarkHtml = displayBadge ? ' <i class="fas fa-circle-check" style="color: #1DA1F2; margin-left: 5px;" title="Verified Member"></i>' : '';
                
                if (userStatusText) {
                    userStatusText.innerHTML = `<i class="fas fa-user" style="margin-right: 6px;"></i>${currentUser.nickname}${checkmarkHtml}`;
                }
                if (authBtn) {
                    authBtn.innerHTML = '<i class="fas fa-sign-out-alt" style="margin-right: 5px;"></i>Log Out';
                }
                if (publishBox) publishBox.style.display = "block";

                // Activation du panel Fufu
                if (isFufu && fufuAdminBox) {
                    fufuAdminBox.style.display = "block";
                    loadAdminSelectOptions();
                }

                // Système Rester Connecté
                let stayConnectedChoice = localStorage.getItem('usms_stay_connected');
                if (stayConnectedChoice === null) {
                    let choice = confirm("Voulez-vous rester connecté à votre prochaine visite ?\n\n[Oui] = Rester connecté.\n[Non] = Déconnexion à la fermeture.");
                    localStorage.setItem('usms_stay_connected', choice ? 'yes' : 'no');
                    stayConnectedChoice = localStorage.getItem('usms_stay_connected');
                }

                if (stayConnectedChoice === 'no') {
                    window.addEventListener('pagehide', (event) => {
                        if (!event.persisted) {
                            document.cookie = "usms_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
                            localStorage.removeItem('usms_stay_connected');
                        }
                    });
                }
            } catch (e) {
                console.error("Erreur d'analyse session cookie:", e);
            }
        } else {
            if (userStatusText) userStatusText.innerHTML = '<i class="fas fa-user-slash" style="margin-right: 6px;"></i>Not connected';
            if (authBtn) authBtn.innerHTML = '<i class="fab fa-discord" style="margin-right: 5px;"></i>Connect with Discord';
        }
    }

    // Gestion clic Connexion / Déconnexion
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            localStorage.removeItem('usms_stay_connected'); 
            window.location.href = !currentUser ? '/api/auth?action=login' : '/api/auth?action=logout';
        });
    }

    // Remplit la liste déroulante de Fufu
    async function loadAdminSelectOptions() {
        if (!adminUserSelect) return;
        try {
            const res = await fetch('/api/members');
            if (!res.ok) return;
            const members = await res.json();
            adminUserSelect.innerHTML = '<option value="">Sélectionne un membre...</option>';
            if (Array.isArray(members)) {
                members.forEach(m => {
                    if (m.username.toLowerCase() !== 'fufuofficial_') {
                        adminUserSelect.innerHTML += `<option value="${m.username}">${m.nickname} (@${m.username})</option>`;
                    }
                });
            }
        } catch (e) {
            console.error("Erreur sélecteur admin:", e);
        }
    }

    // Bouton de certification du Panel Admin de Fufu
    if (adminVerifyBtn) {
        adminVerifyBtn.addEventListener('click', async () => {
            const targetUser = adminUserSelect.value;
            if (!targetUser) return alert("Sélectionne d'abord un membre !");

            const alreadyVerified = globalVerifiedUsers.includes(targetUser.toLowerCase());
            
            try {
                const res = await fetch('/api/videos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggle-verify',
                        targetUser: targetUser.toLowerCase(),
                        isVerified: !alreadyVerified
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Statut de certification mis à jour pour @${targetUser} !`);
                    // Rafraîchissement des variables locales et de l'interface
                    const checkRes = await fetch('/api/videos');
                    const checkData = await checkRes.json();
                    globalVerifiedUsers = checkData.verifiedUsers || [];
                    loadMembers(); 
                }
            } catch (err) {
                alert("Erreur lors de la communication avec la base de données.");
            }
        });
    }

    // Liste complète des membres
    async function loadMembers() {
        if (!membersGrid) return;
        membersGrid.innerHTML = "<p style='padding:15px;'><i class='fas fa-spinner fa-spin'></i> Chargement de la base des membres...</p>";
        
        try {
            const res = await fetch('/api/members');
            if (!res.ok) throw new Error("Erreur API");
            const data = await res.json();

            membersGrid.innerHTML = "";
            data.forEach(member => {
                const card = document.createElement('div');
                card.className = "member-card";
                
                const isMemberVerified = member.username.toLowerCase() === 'fufuofficial_' || globalVerifiedUsers.includes(member.username.toLowerCase());
                const listCheckmark = isMemberVerified ? ' <i class="fas fa-circle-check" style="color: #1DA1F2; font-size:12px; margin-left:4px;"></i>' : '';

                let roleHtml = "<span class='role-badge' style='background:#777; color:#FFF;'>Membre</span>";
                if (member.roles && member.roles.length > 0) {
                    roleHtml = member.roles.map(r => `<span class="role-badge" style="background:${r.color || '#555'}; color:#FFF;">${r.name}</span>`).join(' ');
                }

                card.innerHTML = `
                    <img src="${member.avatar}" alt="Avatar" class="member-avatar">
                    <div class="member-info">
                        <div class="member-name">${member.nickname}${listCheckmark}</div>
                        <div class="member-username">@${member.username}</div>
                        <div class="member-roles" style="margin-top:5px;">${roleHtml}</div>
                    </div>
                `;
                membersGrid.appendChild(card);
            });
        } catch (err) {
            membersGrid.innerHTML = `<p style='padding:15px; color:red;'><i class='fas fa-exclamation-triangle'></i> Impossible de charger la liste.</p>`;
        }
    }

    // Lancement global au démarrage
    initDatabaseAndStatus();
});
