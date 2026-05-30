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
            userStatusText.innerText = `Welcome, ${currentUser.nickname}`;
            authBtn.innerText = "Log Out";
            if (publishBox) publishBox.style.display = "block";

            // Affichage instantané du Panel Admin si c'est fufuofficial_
            if (currentUser.username.toLowerCase() === 'fufuofficial_' && fufuAdminBox) {
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

            // Si l'utilisateur clique sur "Non", on liquide sa session uniquement s'il quitte vraiment l'application
            if (stayConnectedChoice === 'no') {
                window.addEventListener('pagehide', (event) => {
                    // On vérifie que ce n'est pas un simple rafraîchissement ou une redirection interne
                    if (!event.persisted) {
                        document.cookie = "usms_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
                        localStorage.removeItem('usms_stay_connected');
                    }
                });
            }

        } catch (e) {
            console.error("Erreur d'analyse de la session utilisateur :", e);
        }
    }

    // 3. ACTION DU BOUTON DE CONNEXION / DECONNEXION
    authBtn.addEventListener('click', () => {
        localStorage.removeItem('usms_stay_connected'); // Nettoyage du choix local
        if (!currentUser) {
            window.location.href = '/api/auth?action=login';
        } else {
            window.location.href = '/api/auth?action=logout';
        }
    });

    // 4. CHARGEMENT ET RENDU DE LA LISTE DES MEMBRES DISCORD
    async function loadMembers() {
        if (!membersGrid) return;
        membersGrid.innerHTML = "<p style='padding:15px;'>Loading online members database...</p>";
        
        try {
            const res = await fetch('/api/members');
            const data = await res.json();

            if (!data || data.error) {
                membersGrid.innerHTML = `<p style='padding:15px; color:red;'>Error loading data: ${data.message || 'Unknown issue'}</p>`;
                return;
            }

            membersGrid.innerHTML = "";
            data.forEach(member => {
                const card = document.createElement('div');
                card.className = "member-card";
                
                // Extraction du rôle principal ou affichage par défaut
                let roleHtml = "<span class='role-badge' style='background:#777; color:#FFF;'>Member</span>";
                if (member.roles && member.roles.length > 0) {
                    roleHtml = member.roles.map(r => `<span class="role-badge" style="background:${r.color || '#555'}; color:#FFF;">${r.name}</span>`).join(' ');
                }

                card.innerHTML = `
                    <img src="${member.avatar}" alt="Avatar" class="member-avatar">
                    <div class="member-info">
                        <div class="member-name">${member.nickname}</div>
                        <div class="member-username">@${member.username}</div>
                        <div class="member-roles" style="margin-top:5px;">${roleHtml}</div>
                    </div>
                `;
                membersGrid.appendChild(card);
            });
        } catch (err) {
            membersGrid.innerHTML = `<p style='padding:15px; color:red;'>Failed to contact backend API: ${err.message}</p>`;
        }
    }
});
