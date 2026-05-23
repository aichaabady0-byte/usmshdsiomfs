const usersList = document.getElementById('users-list');
const detailsBox = document.getElementById('details-box');
const langSelect = document.getElementById('lang-select');

// Variables globales pour stocker les données reçues
let allMembers = [];
let currentLang = 'fr';

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
    document.getElementById('txt-tagline').innerText = t.tagline;
    document.getElementById('search-input').placeholder = t.searchPlaceholder;
    document.getElementById('btn-search').innerText = t.searchBtn;
    document.getElementById('title-list').innerText = t.titleList;
    document.getElementById('title-details').innerText = t.titleDetails;
    
    const noSelectDiv = document.querySelector('.no-selection p');
    if (noSelectDiv) noSelectDiv.innerText = t.noSelection;
}

// Fonction de chargement principale
async function loadDiscordMembers() {
    try {
        usersList.innerHTML = `<li class='user-item'>${translations[currentLang].loading}</li>`;
        
        const response = await fetch('/api-members');
        const data = await response.json();
        
        if (data.error) {
            usersList.innerHTML = `<li class='user-item' style='color:red;'>${data.error}: ${data.details || ''}</li>`;
            return;
        }

        allMembers = data;
        renderList(allMembers);

    } catch (error) {
        console.error(error);
        usersList.innerHTML = "<li class='user-item' style='color:red;'>Error.</li>";
    }
}

// Générer et afficher la liste triée
function renderList(members) {
    usersList.innerHTML = ""; 

    // TRI AUTOMATIQUE : On trie par le nombre de rôles ou l'importance (les bots/admins d'abord)
    // Discord renvoie les rôles du plus haut au plus bas. On trie les membres selon l'importance de leur premier rôle.
    const sortedMembers = [...members].sort((a, b) => {
        // Si l'un est un bot et pas l'autre, on met le bot un peu après ou avant selon préférence, ici on privilégie l'importance des rôles réels
        const aHasRoles = a.roles && a.roles.length > 0;
        const bHasRoles = b.roles && b.roles.length > 0;
        if (aHasRoles && !bHasRoles) return -1;
        if (!aHasRoles && bHasRoles) return 1;
        return 0; 
    });

    sortedMembers.forEach(member => {
        const li = document.createElement('li');
        li.classList.add('user-item');
        
        // Trouver le rôle le plus important (le premier de la liste renvoyée par l'API)
        const mainRoleName = member.roles.length > 0 ? member.roles[0].name : translations[currentLang].noRole;
        
        // Si c'est un bot (on vérifie via l'API si dispo, ou s'il a un rôle de Bot)
        // Note : Ton api-members.js envoie l'ID ou le pseudo, on peut repérer les bots s'ils contiennent "bot" ou via le style
        const isBot = member.username.toLowerCase().includes('bot') || mainRoleName.toLowerCase().includes('bot');
        
        // Badge APP style Discord moderne mais intégré proprement
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
function selectUser(member, element) {
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');

    const t = translations[currentLang];
    
    // Si c'est un bot pour afficher l'icône dans la fiche aussi
    const isBot = member.username.toLowerCase().includes('bot');
    const botBadge = isBot ? `<span class="app-badge">APP</span>` : '';

    const rolesHtml = member.roles.map(role => 
        `<span class="discord-role" style="background-color: ${role.color || '#99aab5'}">${role.name}</span>`
    ).join(' ');

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

// Écouteur pour le changement de langue
langSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateInterfaceTexts();
    if (allMembers.length > 0) {
        renderList(allMembers); // Re-génère la liste avec les bons textes de rôles vides
    }
});

// Lancement au démarrage
updateInterfaceTexts();
loadDiscordMembers();
