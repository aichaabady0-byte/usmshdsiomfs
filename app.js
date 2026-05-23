let allMembers = [];

async function fetchMembers() {
    try {
        const response = await fetch('/api/members');
        allMembers = await response.json();
        renderGrid(allMembers);
    } catch (error) {
        console.error("Impossible de charger les membres", error);
    }
}

function renderGrid(members) {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = '';

    members.forEach(member => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.onclick = () => showDetails(member);

        // On prend le premier rôle pour l'affichage rapide (ou 'Aucun')
        const mainRole = member.roles.length > 0 ? member.roles[0] : 'Membre';

        card.innerHTML = `
            <div class="thumb-box">
                <img src="${member.avatar}" alt="${member.nickname}">
            </div>
            <div class="member-name">${member.nickname}</div>
            <div class="member-roles">${mainRole}</div>
        `;
        grid.appendChild(card);
    });
}

function showDetails(member) {
    const detailContent = document.getElementById('detail-content');
    
    const rolesBadges = member.roles.length > 0 
        ? member.roles.map(r => `• ${r}`).join('<br>') 
        : 'Aucun rôle';

    detailContent.innerHTML = `
        <img class="detail-avatar" src="${member.avatar}" alt="${member.nickname}">
        <div class="info-group"><strong>Pseudo :</strong> ${member.nickname}</div>
        <div class="info-group"><strong>Nom d'utilisateur :</strong> @${member.username}</div>
        <div class="info-group"><strong>ID :</strong> ${member.id}</div>
        <div class="info-group"><strong>A rejoint le :</strong> ${member.joinedAt}</div>
        <div class="info-group"><strong>Rôles :</strong><br>${rolesBadges}</div>
    `;
}

// Lancement au chargement de la page
window.onload = fetchMembers;
