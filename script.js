document.addEventListener('DOMContentLoaded', () => {
    // Éléments UI Globaux
    const tabs = document.querySelectorAll('.tab');
    const pages = document.querySelectorAll('.page-content');
    const authBtn = document.getElementById('discord-auth-btn');
    const userStatusText = document.getElementById('user-status-text');
    const publishBox = document.getElementById('publish-box');
    const fufuAdminBox = document.getElementById('fufu-admin-box');
    const membersGrid = document.getElementById('members-grid');

    let currentUser = null;

    // 1. SYSTEME DE NAVIGATION PAR ONGLETS
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

    // 2. RECUPERATION ET TRADUCTION DU COOKIE DE SESSION
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    }

    const userCookie = getCookie('usms_user');
    if (userCookie) {
        try {
            currentUser = JSON.parse(userCookie);
            
            // Est-ce que l'utilisateur est Fufu ou possède un rôle Admin/Vérifié ?
            const isFufu = currentUser.username.toLowerCase() === 'fufuofficial_';
            const hasVerifiedBadge = isFufu || currentUser.roles.some(r => r.name.toLowerCase().includes('verified') || r.name.toLowerCase().includes('admin'));

            // MET À JOUR L'INTERFACE AVEC DES ICÔNES VECTORIELLES
            let checkmarkHtml = hasVerifiedBadge ? ' <i class="fas fa-circle-check" style="color: #1DA1F2; margin-left: 5px;" title="Verified Member"></i>' : '';
            userStatusText.innerHTML = `<i class="fas fa-user" style="margin-right: 6px;"></i>${currentUser.nickname}${checkmarkHtml}`;
            
            // Change le bouton de connexion en bouton de déconnexion avec icône
            authBtn.innerHTML = '<i class="fas fa-sign-out-alt" style="margin-right: 5px;"></i>Log Out';
            
            if (publishBox) publishBox.style.display = "block";

            // ACTIVER LES FONCTIONS ADMIN EXCLUSIVES SI C'EST FUFU
            if (isFufu && fufuAdminBox) {
                fufuAdminBox.style.display = "block";
            }

            // LOGIQUE INTERACTIVE : "RESTER CONNECTÉ"
            let stayConnectedChoice = localStorage.getItem('usms_stay_connected');

            if (stayConnectedChoice === null) {
                let choice = confirm("Voulez-vous rester connecté à votre prochaine visite ?\n\n[Oui] = Conserver la session active.\n[Non] = Déconnexion automatique à la fermeture du site.");
                
                if (choice) {
                    localStorage.setItem('usms_stay_connected', 'yes');
                } else {
                    localStorage.setItem('usms_stay_connected', 'no');
                }
                stayConnectedChoice = localStorage.getItem('usms_stay_connected');
            }

            // Si choix = Non, on supprime la session à la fermeture réelle de l'application
            if (stayConnectedChoice === 'no') {
                window.addEventListener('pagehide', (event) => {
                    if (!event.persisted) {
                        document.cookie = "usms_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
                        localStorage.removeItem('usms_stay_connected');
                    }
                });
            }

        } catch (e) {
            console.error("Erreur d'analyse de la session utilisateur :", e);
        }
    } else {
        // Mode déconnecté par défaut avec icônes vectorielles
        userStatusText.innerHTML = '<i class="fas fa-user-slash" style="margin-right: 6px;"></i>Not connected';
        authBtn.innerHTML = '<i class="fab fa-discord" style="margin-right: 5px;"></i>Connect with Discord';
    }

    // 3. ACTION DU BOUTON DE CONNEXION / DECONNEXION
    authBtn.addEventListener('click', () => {
        localStorage.removeItem('usms_stay_connected'); 
        if (!currentUser) {
            window.location.href = '/api/auth?action=login';
        } else {
            window.location.href = '/api/auth?action=logout';
        }
    });

    // 4. CHARGEMENT ET RENDU DE LA LISTE DES MEMBRES DISCORD
    async function loadMembers() {
        if (!membersGrid) return;
        membersGrid.innerHTML = "<p style='padding:15px;'><i class='fas fa-spinner fa-spin'></i> Loading online members database...</p>";
        
        try {
            const res = await fetch('/api/members');
            const data = await res.json();

            if (!data || data.error) {
                membersGrid.innerHTML = `<p style='padding:15px; color:red;'><i class='fas fa-exclamation-triangle'></i> Error loading data: ${data.message || 'Unknown issue'}</p>`;
                return;
            }

            membersGrid.innerHTML = "";
            data.forEach(member => {
                const card = document.createElement('div');
                card.className = "member-card";
                
                // Extraction et badge de rôles
                let roleHtml = "<span class='role-badge' style='background:#777; color:#FFF;'>Member</span>";
                if (member.roles && member.roles.length > 0) {
                    roleHtml = member.roles.map(r => {
                        // Si le rôle contient une couronne dans son texte, on ajoute l'icône vectorielle
                        let icon = r.name.includes('👑') ? '<i class="fas fa-crown" style="margin-right:4px;"></i>' : '';
                        let cleanName = r.name.replace('👑', '').trim();
                        return `<span class="role-badge" style="background:${r.color || '#555'}; color:#FFF;">${icon}${cleanName}</span>`;
                    }).join(' ');
                }

                // Checkmark à côté du nom des membres de la liste s'ils sont vérifiés/admins
                const isMemberAdmin = member.username.toLowerCase() === 'fufuofficial_' || member.roles.some(r => r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('verified'));
                const listCheckmark = isMemberAdmin ? ' <i class="fas fa-circle-check" style="color: #1DA1F2; font-size:12px; margin-left:4px;"></i>' : '';

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
            membersGrid.innerHTML = `<p style='padding:15px; color:red;'><i class='fas fa-exclamation-triangle'></i> Failed to contact backend API: ${err.message}</p>`;
        }
    }
});
