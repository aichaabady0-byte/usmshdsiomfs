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
    let globalVerifiedUsers = []; // Liste des usernames vérifiés par Fufu via la DB

    // Navigation onglets
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active-page'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-target');
            document.getElementById(target).classList.add('active-page');

            if (target === 'page-members' || target === 'page-videos') {
                initVideoAndMembersData();
            }
        });
    });

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    }

    // Initialisation des données de vérification de la DB
    async function initVideoAndMembersData() {
        try {
            const res = await fetch('/api/videos');
            const data = await res.json();
            if (data && data.verifiedUsers) {
                globalVerifiedUsers = data.verifiedUsers;
            }
        } catch (e) {
            console.error("Impossible de récupérer la liste des comptes certifiés:", e);
        }
        loadMembers();
    }

    // Gestion de la session de connexion
    const userCookie = getCookie('usms_user');
    if (userCookie) {
        try {
            currentUser = JSON.parse(userCookie);
            const isFufu = currentUser.username.toLowerCase() === 'fufuofficial_';
            
            // On va chercher si l'utilisateur est certifié dans la DB
            fetch('/api/videos').then(r => r.json()).then(data => {
                if (data && data.verifiedUsers) globalVerifiedUsers = data.verifiedUsers;
                
                const isVerifiedInDb = globalVerifiedUsers.includes(currentUser.username.toLowerCase());
                // Un user est affiché certifié si c'est Fufu OU s'il est validé en BDD
                const displayBadge = isFufu || isVerifiedInDb;

                let checkmarkHtml = displayBadge ? ' <i class="fas fa-circle-check" style="color: #1DA1F2; margin-left: 5px;" title="Verified Member"></i>' : '';
                userStatusText.innerHTML = `<i class="fas fa-user" style="margin-right: 6px;"></i>${currentUser.nickname}${checkmarkHtml}`;
            });

            authBtn.innerHTML = '<i class="fas fa-sign-out-alt" style="margin-right: 5px;"></i>Log Out';
            if (publishBox) publishBox.style.display = "block";

            // Si c'est fufuofficial_, on débloque le pannel secret
            if (isFufu && fufuAdminBox) {
                fufuAdminBox.style.display = "block";
                loadAdminSelectOptions(); // On charge les membres dans sa liste déroulante
            }

            // Gestion du "Rester connecté"
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
            console.error("Erreur session:", e);
        }
    } else {
        userStatusText.innerHTML = '<i class="fas fa-user-slash" style="margin-right: 6px;"></i>Not connected';
        authBtn.innerHTML = '<i class="fab fa-discord" style="margin-right: 5px;"></i>Connect with Discord';
    }

    authBtn.addEventListener('click', () => {
        localStorage.removeItem('usms_stay_connected'); 
        window.location.href = !currentUser ? '/api/auth?action=login' : '/api/auth?action=logout';
    });

    // Remplit le sélecteur admin de Fufu avec les vrais membres du serveur
    async function loadAdminSelectOptions() {
        if (!adminUserSelect) return;
        try {
            const res = await fetch('/api/members');
            const members = await res.json();
            adminUserSelect.innerHTML = '<option value="">Select a member...</option>';
            if (Array.isArray(members)) {
                members.forEach(m => {
                    if (m.username.toLowerCase() !== 'fufuofficial_') {
                        adminUserSelect.innerHTML += `<option value="${m.username}">${m.nickname} (@${m.username})</option>`;
                    }
                });
            }
        } catch (e) {
            console.error("Erreur de chargement du sélecteur admin:", e);
        }
    }

    // Action du bouton du panel de Fufu pour ajouter/retirer la certification KV
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
                    initVideoAndMembersData(); // Rafraîchit l'affichage global
                }
            } catch (err) {
                alert("Erreur lors de la mise à jour bdd.");
            }
        });
    }

    // Affichage des membres dans l'onglet dédié
    async function loadMembers() {
        if (!membersGrid) return;
        membersGrid.innerHTML = "<p style='padding:15px;'><i class='fas fa-spinner fa-spin'></i> Loading members...</p>";
        
        try {
            const res = await fetch('/api/members');
            const data = await res.json();
            if (!data || data.error) {
                membersGrid.innerHTML = `<p style='padding:15px; color:red;'>Error</p>`;
                return;
            }

            membersGrid.innerHTML = "";
            data.forEach(member => {
                const card = document.createElement('div');
                card.className = "member-card";
                
                // Un membre a la coche si c'est Fufu OU s'il est dans le tableau KV
                const isMemberVerified = member.username.toLowerCase() === 'fufuofficial_' || globalVerifiedUsers.includes(member.username.toLowerCase());
                const listCheckmark = isMemberVerified ? ' <i class="fas fa-circle-check" style="color: #1DA1F2; font-size:12px; margin-left:4px;"></i>' : '';

                let roleHtml = "<span class='role-badge' style='background:#777; color:#FFF;'>Member</span>";
                if (member.roles && member.roles.length > 0) {
                    roleHtml = member.roles.map(r => `<span class="role-badge" style="background:${r.color || '#555'};">${r.name}</span>`).join(' ');
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
            membersGrid.innerHTML = `<p style='padding:15px; color:red;'>Error API</p>`;
        }
    }

    // Premier chargement transparent au démarrage
    initVideoAndMembersData();
});
