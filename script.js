document.addEventListener("DOMContentLoaded", () => {
    
    const membersGrid = document.getElementById('members-grid');
    const searchInput = document.getElementById('search-input');
    const langSelect = document.getElementById('lang-select');
    const currentFlag = document.getElementById('current-flag');
    const pageTitle = document.getElementById('page-title');
    
    // Zone de détails rétro
    const profileDetailZone = document.getElementById('profile-detail-zone');
    const modalBody = document.getElementById('modal-body');
    const detailTitleText = document.getElementById('detail-title-text');

    let allMembers = [];
    let currentLang = 'en';

    const translations = {
        en: {
            title: "Channels / Server Members",
            searchPlaceholder: "Search a member...",
            loading: "Loading members...",
            error: "Failed to load server members.",
            noRole: "No Role",
            joinDate: "Join Date:",
            nickname: "Nickname:",
            roles: "Roles:",
            username: "Username:",
            inspectTitle: "Member Profile Inspection"
        },
        fr: {
            title: "Chaînes / Membres du Serveur",
            searchPlaceholder: "Rechercher un membre...",
            loading: "Chargement...",
            error: "Échec du chargement.",
            noRole: "Aucun rôle",
            joinDate: "Date d'arrivée :",
            nickname: "Pseudo :",
            roles: "Rôles :",
            username: "Nom d'utilisateur :",
            inspectTitle: "Inspection du Profil Membre"
        },
        zh: {
            title: "频道 / 服务器成员列表",
            searchPlaceholder: "搜索成员...",
            loading: "正在加载...",
            error: "无法加载成员数据。",
            noRole: "无身份组",
            joinDate: "加入日期:",
            nickname: "昵称:",
            roles: "身份组:",
            username: "用户名:",
            inspectTitle: "成员详细档案"
        }
    };

    async function loadMembers() {
        try {
            const response = await fetch('/api/members');
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            allMembers = data.members || [];
            renderGrid(allMembers);
        } catch (error) {
            console.error(error);
            membersGrid.innerHTML = `<div class="loading" style="color:red;">${translations[currentLang].error}</div>`;
        }
    }

    function renderGrid(membersList) {
        membersGrid.innerHTML = "";
        const t = translations[currentLang];

        if (membersList.length === 0) {
            membersGrid.innerHTML = `<div class="loading">No members found.</div>`;
            return;
        }

        membersList.forEach(member => {
            const hasRoles = member.roles && member.roles.length > 0;
            const topRoleName = hasRoles ? member.roles[0].name : t.noRole;
            let topRoleColor = hasRoles ? member.roles[0].color : "#666666";

            // SÉCURITÉ CONTRASTE : Si la couleur du rôle est blanche ou noire par défaut, on applique du gris ou du noir
            if (topRoleColor.toLowerCase() === '#ffffff' || topRoleColor.toLowerCase() === '#000000') {
                topRoleColor = '#000000';
            }

            const card = document.createElement('div');
            card.classList.add('member-card');
            
            card.innerHTML = `
                <div class="avatar-container">
                    <img class="card-avatar" src="${member.avatar}" alt="avatar">
                </div>
                <div class="card-name">${member.nickname}</div>
                <div class="card-role" style="color: ${topRoleColor};">
                    ${topRoleName}
                </div>
            `;

            card.addEventListener('click', () => showVintageProfile(member));
            membersGrid.appendChild(card);
        });
    }

    function showVintageProfile(member) {
        const t = translations[currentLang];
        
        let formattedDate = "N/A";
        if (member.joinedAt) {
            const dateObj = new Date(member.joinedAt);
            const localeStr = currentLang === 'fr' ? 'fr-FR' : (currentLang === 'zh' ? 'zh-CN' : 'en-US');
            formattedDate = dateObj.toLocaleDateString(localeStr, { year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        const rolesHtml = member.roles && member.roles.length > 0
            ? member.roles.map(r => {
                let color = r.color;
                // SÉCURITÉ CONTRASTE : Idem pour les badges de la fiche d'inspection
                if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#000000') {
                    color = '#000000';
                }
                return `<span class="modal-role-badge" style="color: ${color}; border-color: ${color};">${r.name}</span>`;
            }).join('')
            : `<div>${t.noRole}</div>`;

        modalBody.innerHTML = `
            <div class="profile-header">
                <img class="modal-avatar" src="${member.avatar}" alt="avatar">
                <div class="modal-title-info">
                    <h2><strong>${member.nickname}</strong></h2>
                    <span>@${member.username}</span>
                </div>
            </div>
            
            <div class="modal-row">
                <span class="modal-label">${t.nickname}</span>
                <div class="modal-value">${member.nickname}</div>
            </div>

            <div class="modal-row">
                <span class="modal-label">${t.joinDate}</span>
                <div class="modal-value">${formattedDate}</div>
            </div>

            <div class="modal-row">
                <span class="modal-label">${t.roles}</span>
                <div class="modal-roles-list">${rolesHtml}</div>
            </div>
        `;

        profileDetailZone.style.display = "block";
        profileDetailZone.scrollIntoView({ behavior: 'smooth' });
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = allMembers.filter(m => 
            m.nickname.toLowerCase().includes(query) || 
            m.username.toLowerCase().includes(query)
        );
        renderGrid(filtered);
    });

    langSelect.addEventListener('change', (e) => {
        currentLang = e.target.value;
        
        const flags = { en: "https://flagcdn.com/16x12/us.png", fr: "https://flagcdn.com/16x12/fr.png", zh: "https://flagcdn.com/16x12/cn.png" };
        if (currentFlag) currentFlag.src = flags[currentLang];
        
        const t = translations[currentLang];
        pageTitle.innerText = t.title;
        detailTitleText.innerText = t.inspectTitle;
        searchInput.placeholder = t.searchPlaceholder;
        
        profileDetailZone.style.display = "none";

        if (allMembers.length > 0) renderGrid(allMembers);
    });

    loadMembers();
});
