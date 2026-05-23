// On attend que toute la page HTML soit construite dans le navigateur
document.addEventListener("DOMContentLoaded", () => {
    
    const usersList = document.getElementById('users-list');
    const detailsBox = document.getElementById('details-box');
    const langSelect = document.getElementById('lang-select');
    const searchInput = document.getElementById('search-input');
    const btnSearch = document.getElementById('btn-search');

    // Variables globales pour stocker les données reçues
    let allMembers = [];
    let currentLang = 'en'; // <--- Modifié ici pour démarrer en anglais !

    // Traductions de l'interface
    const translations = {
        fr: {
            tagline: "Broadcast Yourself™",
            searchPlaceholder: "Rechercher un membre...",
            searchBtn: "Rechercher",
            titleList: "Membres Connectés",
            titleDetails: "Fiche Profil USMSCord",
            loading: "Chargement de la liste...",
            noSelection: "Sélectionnez un membre de la communauté à gauche pour charger ses détails.",
            statusLabel: "Statut Actuel :",
            idLabel: "Identifiant unique :",
            rolesLabel: "Rôles USMSCord :",
            noRole: "Aucun rôle",
            status: { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger", offline: "Hors ligne" }
        },
        en: {
            tagline: "Broadcast Yourself™",
            searchPlaceholder: "Search a member...",
            searchBtn: "Search",
            titleList: "Connected Members",
            titleDetails: "USMSCord Profile Card",
            loading: "Loading list...",
            noSelection: "Select a community member on the left to view their details.",
            statusLabel: "Current Status:",
            idLabel: "Unique Identifier:",
            rolesLabel: "USMSCord Roles:",
            noRole: "No role",
            status: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" }
        },
        zh: {
            tagline: "Broadcast Yourself™ (播送自己™)",
            searchPlaceholder: "搜索成员...",
            searchBtn: "搜索",
            titleList: "在线成员",
            titleDetails: "USMSCord 个人资料卡",
            loading: "正在加载列表...",
            noSelection: "请选择左侧的社区成员以查看其详细信息。",
            statusLabel: "当前状态 :",
            idLabel: "唯一标识符 :",
            rolesLabel: "USMSCord 身份组 :",
            noRole: "无身份组",
            status: { online: "在线", idle: "闲置", dnd: "请勿打扰", offline: "离线" }
        }
    };

    // Mettre à jour les textes fixes du site selon la langue
    function updateInterfaceTexts() {
        const t = translations[currentLang];
        if(document.getElementById('txt-tagline')) document.getElementById('txt-tagline').innerText = t.tagline;
        if(searchInput) searchInput.placeholder = t.searchPlaceholder;
        if(btnSearch) btnSearch.innerText = t.searchBtn;
        if(document.getElementById('title-list')) document.getElementById('title-list').innerText = t.titleList;
        if(document.getElementById('title-details')) document.getElementById('title-details').innerText = t.titleDetails;
        
        const noSelectDiv = document.querySelector('.no-selection p');
        if (noSelectDiv) noSelectDiv.innerText = t.noSelection;
    }

    // Fonction de chargement principale
    async function loadDiscordMembers() {
        try {
            if (usersList) usersList.innerHTML = `<li class='user-item'>${translations[currentLang].loading}</li>`;
            
            const response = await fetch('/api-members');
            const data = await response.json();
            
            if (data.error) {
                if (usersList) usersList.innerHTML = `<li class='user-item' style='color:red;'>${data.error}: ${data.details || ''}</li>`;
                return;
            }

            allMembers = data;
            renderList(allMembers);

        } catch (error) {
            console.error(error);
            if (usersList) usersList.innerHTML = "<li class='user-item' style='color:red;'>Erreur de chargement de l'API.</li>";
        }
    }

    // Générer et afficher la liste triée
    function renderList(members) {
        if (!usersList) return;
        usersList.innerHTML = ""; 

        // Tri : les membres qui ont des rôles en premier
        const sortedMembers = [...members].sort((a, b) => {
            const aHasRoles = a.roles && a.roles.length > 0;
            const bHasRoles = b.roles && b.roles.length > 0;
            if (aHasRoles && !bHasRoles) return -1;
            if (!aHasRoles && bHasRoles) return 1;
            return 0; 
        });

        sortedMembers.forEach(member => {
            const li = document.createElement('li');
            li.classList.add('user-item');
            
            const mainRoleName = member.roles.length > 0 ? member.roles[0].name : translations[currentLang].noRole;
            const isBot = member.username.toLowerCase().includes('bot') || mainRoleName.toLowerCase().includes('bot');
            const botBadge = isBot ? `<span class="app-badge">APP</span>` : '';

            li.innerHTML = `
                <img class="mini-avatar" src="${member.avatar}" alt="avatar" onerror="this.src='https://discord.com/assets/c09a43a372ba40e85774.png'">
                <div class="user-info">
                    <span class="nickname">${member.nickname} ${botBadge}</span>
                    <span class="role-tag">${mainRoleName}</span>
                </div>
            `;
            
            li.addEventListener('click', () => selectUser(member, li));
            usersList.appendChild(li);
        });
    }

    // Afficher la fiche de détails
    // Afficher la fiche de détails
    function selectUser(member, element) {
        if (!detailsBox) return;
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');

        const t = translations[currentLang];
        const isBot = member.username.toLowerCase().includes('bot');
        const botBadge = isBot ? `<span class="app-badge">APP</span>` : '';

        // Génération des rôles avec gestion automatique de la couleur du texte
        const rolesHtml = member.roles.map(role => {
            const roleColor = role.color || '#99aab5';
            
            // Sécurité : Si la couleur est du blanc pur (#ffffff, #fff) ou un blanc Discord (#000000 renvoyé par défaut parfois)
            // On vérifie si la couleur est blanche pour forcer le texte en noir
            const isWhiteBackground = roleColor.toLowerCase() === '#ffffff' || roleColor.toLowerCase() === '#fff';
            const textColor = isWhiteBackground ? '#000000' : '#ffffff';
            
            return `<span class="discord-role" style="background-color: ${roleColor}; color: ${textColor};">${role.name}</span>`;
        }).join(' ');

        detailsBox.innerHTML = `
            <div class="profile-header">
                <img class="big-avatar" src="${member.avatar}" alt="Avatar" onerror="this.src='https://discord.com/assets/c09a43a372ba40e85774.png'">
                <div class="profile-title">
                    <h2>${member.nickname} ${botBadge}</h2>
                    <span class="discord-tag">@${member.username}</span>
                </div>
            </div>
            
            <div class="info-row">
                <span class="info-label">${t.statusLabel}</span> <strong>${t.status[member.status] || member.status}</strong>
            </div>
            <div class="info-row">
                <span class="info-label">${t.idLabel}</span> <span style="font-family: monospace; font-size: 12px;">${member.id}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${t.rolesLabel}</span>
                <div class="roles-container">
                    ${rolesHtml || `<span style="color:#666; font-style:italic;">${t.noRole}</span>`}
                </div>
            </div>
        `;
    }

    // SÉCURITÉ : On vérifie que langSelect existe bien avant de poser l'écouteur
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            updateInterfaceTexts();
            if (allMembers.length > 0) {
                renderList(allMembers);
            }
        });
    }

    // Lancement au démarrage
    updateInterfaceTexts();
    loadDiscordMembers();
});
