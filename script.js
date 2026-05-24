document.addEventListener("DOMContentLoaded", () => {
    
    const membersGrid = document.getElementById('members-grid');
    const searchInput = document.getElementById('search-input');
    const langSelect = document.getElementById('lang-select');
    const currentFlag = document.getElementById('current-flag');
    const pageTitle = document.getElementById('page-title');
    
    const profileModal = document.getElementById('profile-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('.close-modal-btn');

    let allMembers = [];
    let currentLang = 'en';

    const translations = {
        en: {
            title: "Server Members",
            searchPlaceholder: "Search a member...",
            loading: "Loading members from Discord...",
            error: "Failed to load server members.",
            noRole: "No Role",
            joinDate: "Join Date",
            nickname: "Nickname",
            roles: "Roles",
            username: "Username"
        },
        fr: {
            title: "Membres du Serveur",
            searchPlaceholder: "Rechercher un membre...",
            loading: "Chargement des membres depuis Discord...",
            error: "Échec du chargement des membres.",
            noRole: "Aucun rôle",
            joinDate: "Date d'arrivée",
            nickname: "Pseudo",
            roles: "Rôles",
            username: "Nom d'utilisateur"
        },
        zh: {
            title: "服务器成员",
            searchPlaceholder: "搜索成员...",
            loading: "正在从 Discord 加载成员...",
            error: "无法加载成员数据。",
            noRole: "无身份组",
            joinDate: "加入日期",
            nickname: "昵称",
            roles: "身份组",
            username: "用户名"
        }
    };

    async function loadMembers() {
    try {
        const response = await fetch('/api/members');
        const data = await response.json();
        
        if (!response.ok) {
            // Affichage précis dans la console pour savoir exactement ce qui bloque
            console.error("DÉTAILS DE L'ERREUR 500 DE DISCORD :", data);
            throw new Error(data.error || 'API Error');
        }
        
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
            const topRoleColor = hasRoles ? member.roles[0].color : "#666666";

            const card = document.createElement('div');
            card.classList.add('member-card');
            
            card.innerHTML = `
                <div class="avatar-container">
                    <img class="card-avatar" src="${member.avatar}" alt="avatar">
                    <span class="status-dot ${member.status}"></span>
                </div>
                <div class="card-name">${member.nickname}</div>
                <div class="card-role" style="color: ${topRoleColor === '#000000' ? '#555' : topRoleColor};">
                    ${topRoleName}
                </div>
            `;

            card.addEventListener('click', () => openProfileModal(member));
            membersGrid.appendChild(card);
        });
    }

    function openProfileModal(member) {
        const t = translations[currentLang];
        
        // Formatage de la date en fonction de la langue sélectionnée
        let formattedDate = "N/A";
        if (member.joinedAt) {
            const dateObj = new Date(member.joinedAt);
            const localeStr = currentLang === 'fr' ? 'fr-FR' : (currentLang === 'zh' ? 'zh-CN' : 'en-US');
            formattedDate = dateObj.toLocaleDateString(localeStr, { year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        const rolesHtml = member.roles && member.roles.length > 0
            ? member.roles.map(r => {
                const color = r.color === '#000000' ? '#444444' : r.color;
                return `<span class="modal-role-badge" style="color: ${color};">${r.name}</span>`;
            }).join('')
            : `<div>${t.noRole}</div>`;

        modalBody.innerHTML = `
            <div class="modal-header">
                <img class="modal-avatar" src="${member.avatar}" alt="avatar">
                <div class="modal-title-info">
                    <h2>${member.nickname}</h2>
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

        profileModal.classList.add('open');
    }

    closeModalBtn.addEventListener('click', () => profileModal.classList.remove('open'));
    profileModal.addEventListener('click', (e) => {
        if(e.target === profileModal) profileModal.classList.remove('open');
    });

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
        searchInput.placeholder = t.searchPlaceholder;
        
        profileModal.classList.remove('open');

        if (allMembers.length > 0) renderGrid(allMembers);
    });

    loadMembers();
});
