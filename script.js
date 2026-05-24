import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    
    const usersList = document.getElementById('users-list');
    const detailsBox = document.getElementById('details-box');
    const langSelect = document.getElementById('lang-select');
    const currentFlag = document.getElementById('current-flag');
    
    const boxTitleText = document.getElementById('box-title-text');
    const profileTitleText = document.getElementById('profile-title-text');

    let allMembers = [];
    let currentLang = 'en';
    let database;

    // TA CONFIGURATION FIREBASE SECRÈTE
    const firebaseConfig = {
        apiKey: "METS_TON_API_KEY_ICI",
        authDomain: "usmscord.firebaseapp.com",
        databaseURL: "https://usmscord-default-rtdb.firebaseio.com/",
        projectId: "usmscord",
        storageBucket: "usmscord.appspot.com",
        messagingSenderId: "TON_MESSAGING_SENDER_ID",
        appId: "TON_APP_ID"
    };

    const app = initializeApp(firebaseConfig);
    database = getDatabase(app);

    // TRADUCTIONS DES LANGUES 2006
    const translations = {
        en: {
            boxTitle: "Discord Members",
            profileTitle: "Member Profile Card",
            noSelection: "Select a member on the left to inspect their vintage profile card.",
            noRole: "No group / role",
            statusLabel: "Status:",
            rolesLabel: "Groups/Roles:",
            loading: "Loading members data...",
            empty: "No members synchronized by the bot yet.",
            status: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" }
        },
        fr: {
            boxTitle: "Membres Discord",
            profileTitle: "Fiche Profil du Membre",
            noSelection: "Sélectionne un membre à gauche pour inspecter sa fiche profil rétro.",
            noRole: "Aucun groupe / rôle",
            statusLabel: "Statut :",
            rolesLabel: "Groupes/Rôles :",
            loading: "Chargement des membres...",
            empty: "Aucun membre synchronisé par le bot pour l'instant.",
            status: { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger", offline: "Hors ligne" }
        },
        zh: {
            boxTitle: "Discord 成员列表",
            profileTitle: "成员档案卡",
            noSelection: "在左侧选择一个成员以查看其复古档案卡。",
            noRole: "无身份组 / 角色",
            statusLabel: "在线状态:",
            rolesLabel: "身份组:",
            loading: "正在加载成员数据...",
            empty: "目前没有机器人同步的成员。",
            status: { online: "在线", idle: "闲置", dnd: "请勿打扰", offline: "离线" }
        }
    };

    // Lecture du nœud de synchronisation créé par ton bot Discord
    function listenToDiscordMembers() {
        if (!database) return;

        const t = translations[currentLang];
        if (usersList) usersList.innerHTML = `<li class="loading-item">${t.loading}</li>`;

        onValue(ref(database, 'discordMembers'), (snapshot) => {
            if (snapshot.exists()) {
                allMembers = Object.values(snapshot.val());
                renderList(allMembers);
            } else {
                if (usersList) usersList.innerHTML = `<li style="padding:10px;color:#888;text-align:center;">${t.empty}</li>`;
            }
        });
    }

    function renderList(members) {
        if (!usersList) return;
        usersList.innerHTML = ""; 
        const t = translations[currentLang];

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

    function selectUser(member, element) {
        if (!detailsBox) return;
        
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');
        
        const t = translations[currentLang];
        
        const rolesHtml = member.roles && member.roles.length > 0 
            ? member.roles.map(role => `<span class="discord-role" style="background-color: ${role.color === '#000000' ? '#FFFFFF' : role.color}; color: ${role.color === '#000000' ? '#333' : '#FFF'}; border-color: ${role.color === '#000000' ? '#999' : role.color};">${role.name}</span>`).join(' ')
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

    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            
            const flagUrls = { en: "https://flagcdn.com/16x12/us.png", fr: "https://flagcdn.com/16x12/fr.png", zh: "https://flagcdn.com/16x12/cn.png" };
            if (currentFlag) currentFlag.src = flagUrls[currentLang];
            
            const t = translations[currentLang];
            if (boxTitleText) boxTitleText.innerText = t.boxTitle;
            if (profileTitleText) profileTitleText.innerText = t.profileTitle;
            
            detailsBox.innerHTML = `<div class="no-selection"><i class="fa-solid fa-arrow-left" style="margin-right: 5px;"></i>${t.noSelection}</div>`;
            if (allMembers.length > 0) renderList(allMembers);
        });
    }

    listenToDiscordMembers();
});
