document.addEventListener("DOMContentLoaded", () => {
    
    const usersList = document.getElementById('users-list');
    const detailsBox = document.getElementById('details-box');
    const langSelect = document.getElementById('lang-select');
    const currentFlag = document.getElementById('current-flag');
    
    const boxTitleText = document.getElementById('box-title-text');
    const profileTitleText = document.getElementById('profile-title-text');

    let allMembers = [];
    let currentLang = 'en';

    // TRADUCTIONS DES STRINGS DE L'UI (STYLE YOUTUBE 2006)
    const translations = {
        en: {
            boxTitle: "Connected Members",
            profileTitle: "USMS Profile Card",
            noSelection: "Select a community member on the left to view their details.",
            noRole: "No role",
            statusLabel: "Status:",
            rolesLabel: "Roles:",
            loading: "Loading...",
            error: "Failed to load community data.",
            status: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" }
        },
        fr: {
            boxTitle: "Membres Connectés",
            profileTitle: "Fiche Profil USMS",
            noSelection: "Sélectionnez un membre de la communauté à gauche pour voir ses détails.",
            noRole: "Aucun rôle",
            statusLabel: "Statut :",
            rolesLabel: "Rôles :",
            loading: "Chargement...",
            error: "Échec du chargement des données.",
            status: { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger", offline: "Hors ligne" }
        },
        zh: {
            boxTitle: "已连接的成员",
            profileTitle: "USMS 档案卡",
            noSelection: "在左侧选择一个社区成员以查看其详细信息。",
            noRole: "无身份组",
            statusLabel: "在线状态:",
            rolesLabel: "身份组:",
            loading: "正在加载...",
            error: "无法加载成员数据。",
            status: { online: "在线", idle: "闲置", dnd: "请勿打扰", offline: "离线" }
        }
    };

    // Appeler l'API Serverless Node de Vercel
    async function fetchDiscordData() {
        try {
            const response = await fetch('/api/members');
            if (!response.ok) throw new Error('API Response Error');
            
            const data = await response.json();
            allMembers = data.members || [];
            renderList(allMembers);
        } catch (error) {
            console.error("Fetch Error:", error);
            const t = translations[currentLang];
            if (usersList) usersList.innerHTML = `<li style="padding:10px; color:red;">${t.error}</li>`;
        }
    }

    // Afficher la liste des membres à gauche
    function renderList(members) {
        if (!usersList) return;
        usersList.innerHTML = ""; 
        const t = translations[currentLang];

        if(members.length === 0) {
            usersList.innerHTML = `<li style="padding:10px;color:#888;">No members found</li>`;
            return;
        }

        members.forEach(member => {
            const li = document.createElement('li');
            li.classList.add('user-item');
            
            const mainRoleName = member.roles && member.roles.length > 0 ? member.roles[0].name : t.noRole;
            const mainRoleColor = member.roles && member.roles.length > 0 ? member.roles[0].color : "#666666";

            li.innerHTML = `
                <div class="avatar-container">
                    <img class="mini-avatar" src="${member.avatar}" alt="avatar">
                    <span class="status-dot ${member.status}"></span>
                </div>
                <div class="user-info">
                    <span class="nickname" style="color: ${mainRoleColor === '#000000' ? '#0033CC' : mainRoleColor};">${member.nickname}</span>
                    <span class="role-tag">${mainRoleName}</span>
                </div>
            `;
            li.addEventListener('click', () => selectUser(member, li));
            usersList.appendChild(li);
        });
    }

    // Afficher la fiche d'un membre à droite
    function selectUser(member, element) {
        if (!detailsBox) return;
        
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');
        
        const t = translations[currentLang];
        
        const rolesHtml = member.roles && member.roles.length > 0 
            ? member.roles.map(role => {
                const color = role.color === '#000000' ? '#333333' : role.color;
                return `<span class="discord-role" style="color: ${color}; border-color: ${color};">${role.name}</span>`;
              }).join(' ')
            : `<span>${t.noRole}</span>`;

        detailsBox.innerHTML = `
            <div class="profile-header">
                <img class="big-avatar" src="${member.avatar}" alt="Avatar">
                <div class="profile-title">
                    <h2>${member.nickname}</h2>
                    <span>@${member.username}</span>
                </div>
            </div>
            <div class="info-row">
                <span class="info-label">${t.statusLabel}</span> 
                <strong class="status-text">${t.status[member.status] || member.status}</strong>
            </div>
            <div class="info-row">
                <span class="info-label">${t.rolesLabel}</span>
                <div class="roles-container">${rolesHtml}</div>
            </div>
        `;
    }

    // Changement de langues et drapeaux
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            
            const flagUrls = { en: "https://flagcdn.com/16x12/us.png", fr: "https://flagcdn.com/16x12/fr.png", zh: "https://flagcdn.com/16x12/cn.png" };
            if (currentFlag) currentFlag.src = flagUrls[currentLang];
            
            const t = translations[currentLang];
            if (boxTitleText) boxTitleText.innerText = t.boxTitle;
            if (profileTitleText) profileTitleText.innerText = t.profileTitle;
            
            detailsBox.innerHTML = `<div class="no-selection">${t.noSelection}</div>`;
            if (allMembers.length > 0) renderList(allMembers);
        });
    }

    // Charger les membres immédiatement au chargement de la page
    fetchDiscordData();
});
