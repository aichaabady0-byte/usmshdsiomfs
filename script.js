const usersList = document.getElementById('users-list');
const detailsBox = document.getElementById('details-box');

async function loadDiscordMembers() {
    try {
        usersList.innerHTML = "<li class='user-item'>Chargement de la liste...</li>";
        
        // Appelle la fonction Vercel située à la racine
        const response = await fetch('/api-members');
        const members = await response.json();
        
        usersList.innerHTML = ""; 

        if (members.error) {
            usersList.innerHTML = `<li class='user-item' style='color:red;'>Erreur API: ${members.error}</li>`;
            return;
        }

        members.forEach(member => {
            const li = document.createElement('li');
            li.classList.add('user-item');
            const mainRole = member.roles.length > 0 ? member.roles[0].name : "Aucun rôle";
            
            li.innerHTML = `
                <img class="mini-avatar" src="${member.avatar}" alt="avatar" onerror="this.src='https://discord.com/assets/c09a43a372ba40e85774.png'">
                <div class="user-info">
                    <span class="nickname">${member.nickname}</span>
                    <span class="role-tag">Rôle : ${mainRole}</span>
                </div>
            `;
            
            li.addEventListener('click', () => selectUser(member, li));
            usersList.appendChild(li);
        });

    } catch (error) {
        console.error(error);
        usersList.innerHTML = "<li class='user-item' style='color:red;'>Erreur de connexion avec le serveur.</li>";
    }
}

function selectUser(member, element) {
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');

    const statusMap = {
        online: "En ligne",
        idle: "Absent",
        dnd: "Ne pas déranger",
        offline: "Hors ligne"
    };

    const rolesHtml = member.roles.map(role => 
        `<span class="discord-role" style="background-color: ${role.color}">${role.name}</span>`
    ).join(' ');

    detailsBox.innerHTML = `
        <div class="profile-header">
            <img class="big-avatar" src="${member.avatar}" alt="Avatar" onerror="this.src='https://discord.com/assets/c09a43a372ba40e85774.png'">
            <div class="profile-title">
                <h2>${member.nickname}</h2>
                <span class="discord-tag">@${member.username}</span>
            </div>
        </div>
        
        <div class="info-row">
            <span class="info-label">Statut Actuel :</span> <strong>${statusMap[member.status] || 'Inconnu'}</strong>
        </div>
        <div class="info-row">
            <span class="info-label">Identifiant unique :</span> <span style="font-family: monospace; font-size: 12px;">${member.id}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Rôles USMSCord :</span>
            <div class="roles-container">
                ${rolesHtml || '<span style="color:#666; font-style:italic;">Aucun</span>'}
            </div>
        </div>
    `;
}

loadDiscordMembers();
