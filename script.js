document.addEventListener("DOMContentLoaded", () => {
    
    const membersGrid = document.getElementById('members-grid');
    const searchInput = document.getElementById('search-input');
    const langSelect = document.getElementById('lang-select');
    const currentFlag = document.getElementById('current-flag');
    const pageTitle = document.getElementById('page-title');
    
    // Éléments de la modale
    const profileModal = document.getElementById('profile-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('.close-modal-btn');

    let allMembers = [];
    let currentLang = 'en';

    // DICTIONNAIRE DES TRADUCTIONS COMPLETE
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

    // 1. CHARGER LES DONNÉES DE L'API VERCEL
    async function loadMembers() {
        try {
            const response = await fetch('/api/members');
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            
            // On ajoute une fausse joinDate propre si Discord API ne la renvoie pas directement
            allMembers = (data.members || []).map(m => ({
                ...m,
                joinDate: m.joinDate || new Date().toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : 'en-US')
            }));
            
            renderGrid(allMembers);
        } catch (error) {
            console.error(error);
            membersGrid.innerHTML = `<div class="loading" style="color:red;">${translations[currentLang].error}</div>`;
        }
    }

    // 2. AFFICHER LA GRILLE DES CARTES
    function renderGrid(membersList) {
        membersGrid.innerHTML = "";
        const t = translations[currentLang];

        if (membersList.length === 0) {
            membersGrid.innerHTML = `<div class="loading">No members found.</div>`;
            return;
        }

        membersList.forEach(member => {
            // Identifier le plus haut rôle
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

            // Ouvrir la popup au clic sur la carte
            card.addEventListener('click', () => openProfileModal(member));
            membersGrid.appendChild(card);
        });
    }

    // 3. OUVRIR LA POPUP (MODALE) DETROUSSEE
    function openProfileModal(member) {
        const t = translations[currentLang];
        
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
                <div class="modal-value">${member.joinDate}</div>
            </div>

            <div class="modal-row">
                <span class="modal-label">${t.roles}</span>
                <div class="modal-roles-list">${rolesHtml}</div>
            </div>
        `;

        profileModal.classList.add('open');
    }

    // FERMER LA POPUP
    closeModalBtn.addEventListener('click', () => profileModal.classList.remove('open'));
    profileModal.addEventListener('click', (e) => {
        if(e.target === profileModal) profileModal.classList.remove('open');
    });

    // 4. BARRE DE RECHERCHE EN TEMPS RÉEL
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = allMembers.filter(m => 
            m.nickname.toLowerCase().includes(query) || 
            m.username.toLowerCase().includes(query)
        );
        renderGrid(filtered);
    });

    // 5. COMMUTATEUR DE LANGUES
    langSelect.addEventListener('change', (e) => {
        currentLang = e.target.value;
        
        // Ajustement du drapeau
        const flags = { en: "https://flagcdn.com/16x12/us.png", fr: "https://flagcdn.com/16x12/fr.png", zh: "https://flagcdn.com/16x12/cn.png" };
        if (currentFlag) currentFlag.src = flags[currentLang];
        
        // Traduction de l'interface globale
        const t = translations[currentLang];
        pageTitle.innerText = t.title;
        searchInput.placeholder = t.searchPlaceholder;
        
        // Fermer la modale si elle est ouverte pour éviter les conflits de traduction textuelle à la volée
        profileModal.classList.remove('open');

        // Ré-afficher la grille traduite
        if (allMembers.length > 0) renderGrid(allMembers);
    });

    // Initialisation
    loadMembers();
});
