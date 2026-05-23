import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, push, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// CONFIGURATION FIREBASE À COMPLÉTER AVEC TES INFOS
const firebaseConfig = {
    apiKey: "TON_API_KEY",
    authDomain: "TON_PROJECT.firebaseapp.com",
    databaseURL: "https://TON_PROJECT-default-rtdb.firebaseio.com",
    projectId: "TON_PROJECT",
    storageBucket: "TON_PROJECT.appspot.com",
    messagingSenderId: "TON_ID",
    appId: "TON_APP_ID"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

document.addEventListener("DOMContentLoaded", () => {
    
    // Éléments HTML structurels
    const usersList = document.getElementById('users-list');
    const detailsBox = document.getElementById('details-box');
    const langSelect = document.getElementById('lang-select');
    const channelsTree = document.getElementById('channels-tree');
    
    // Éléments de vues (Panels de droite)
    const viewProfile = document.getElementById('view-profile');
    const viewChat = document.getElementById('view-chat');
    const viewAdmin = document.getElementById('view-admin');
    const btnConfigWebsite = document.getElementById('btn-config-website');

    // Éléments Chat & Firebase
    const chatMessages = document.getElementById('chat-messages');
    const chatInputText = document.getElementById('chat-input-text');
    const btnSendMessage = document.getElementById('btn-send-message');
    const activeChannelName = document.getElementById('active-channel-name');

    let allMembers = [];
    let currentLang = 'en';
    let activeChannelId = null;
    let currentUserData = null;

    // --- SYSTÈME D'ONGLETS DE LA SIDEBAR GAUCHE ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    // Écouteur pour le bouton d'administration
    btnConfigWebsite.addEventListener('click', () => {
        switchView(viewAdmin);
    });

    function switchView(targetView) {
        viewProfile.classList.add('hidden');
        viewChat.classList.add('hidden');
        viewAdmin.classList.add('hidden');
        targetView.classList.remove('hidden');
    }

    // --- LE DICTIONNAIRE DE TRADUCTION ---
    const translations = {
        en: { tagline: "Broadcast Yourself™", loading: "Loading...", noRole: "No role", status: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" } },
        fr: { tagline: "Broadcast Yourself™", loading: "Chargement...", noRole: "Aucun rôle", status: { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger", offline: "Hors ligne" } },
        zh: { tagline: "Broadcast Yourself™", loading: "正在加载...", noRole: "无身份组", status: { online: "在线", idle: "闲置", dnd: "请勿打扰", offline: "离线" } }
    };

    // --- CHARGEMENT DE L'API MEMBRES ET SALONS ---
    async function loadDiscordData() {
        try {
            if (usersList) usersList.innerHTML = `<li>${translations[currentLang].loading}</li>`;
            
            const response = await fetch('/api-members');
            const data = await response.json();
            
            if (data.error) return;

            // Remplissage infos serveur
            if(data.guildInfo) {
                document.getElementById('srv-name').innerText = data.guildInfo.name || "USMS Server";
                document.getElementById('srv-id').innerText = data.guildInfo.id || "0000";
                document.getElementById('srv-roles').innerText = data.guildInfo.rolesCount || "0";
            }

            // Génération de l'arbre des salons (Groups)
            if(data.channels) {
                renderChannels(data.channels);
            }

            allMembers = data.members || data;
            renderList(allMembers);
        } catch (error) {
            console.error(error);
        }
    }

    function renderChannels(channels) {
        if (!channelsTree) return;
        channelsTree.innerHTML = "";

        // Regrouper par catégorie
        const categories = channels.filter(c => c.type === 4).sort((a,b) => a.position - b.position);
        const textChannels = channels.filter(c => c.type === 0).sort((a,b) => a.position - b.position);

        categories.forEach(cat => {
            const catDiv = document.createElement('div');
            catDiv.classList.add('category-row');
            catDiv.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${cat.name}`;
            channelsTree.appendChild(catDiv);

            // Salons appartenant à cette catégorie
            const children = textChannels.filter(c => c.parentId === cat.id);
            children.forEach(chan => {
                const chanLink = document.createElement('a');
                chanLink.classList.add('channel-click');
                chanLink.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${chan.name}`;
                chanLink.addEventListener('click', () => selectChannel(chan));
                channelsTree.appendChild(chanLink);
            });
        });
    }

    function selectChannel(channel) {
        document.querySelectorAll('.channel-click').forEach(el => el.classList.remove('active'));
        activeChannelId = channel.id;
        activeChannelName.innerText = channel.name;
        switchView(viewChat);
        listenToChannelMessages(channel.id);
    }

    function renderList(members) {
        if (!usersList) return;
        usersList.innerHTML = ""; 

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
            li.addEventListener('click', () => { switchView(viewProfile); selectUser(member, li); });
            usersList.appendChild(li);
        });
    }

    function selectUser(member, element) {
        if (!detailsBox) return;
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');
        const t = translations[currentLang];
        const isBot = member.username.toLowerCase().includes('bot');
        const botBadge = isBot ? `<span class="app-badge">APP</span>` : '';

        const rolesHtml = member.roles.map(role => {
            const roleColor = role.color || '#99aab5';
            const isWhite = roleColor.toLowerCase() === '#ffffff' || roleColor.toLowerCase() === '#fff';
            return `<span class="discord-role" style="background-color: ${roleColor}; color: ${isWhite ? '#000':'#fff'};">${role.name}</span>`;
        }).join(' ');

        detailsBox.innerHTML = `
            <div class="profile-header">
                <img class="big-avatar" src="${member.avatar}" alt="Avatar">
                <div class="profile-title"><h2>${member.nickname} ${botBadge}</h2><span>@${member.username}</span></div>
            </div>
            <div class="info-row"><span class="info-label">${t.statusLabel || 'Status:'}</span> <strong>${t.status[member.status] || member.status}</strong></div>
            <div class="info-row"><span class="info-label">ID:</span> <span style="font-family:monospace;">${member.id}</span></div>
            <div class="info-row"><span class="info-label">Roles:</span><div class="roles-container">${rolesHtml || `<span>${t.noRole}</span>`}</div></div>
        `;
    }

    // --- MESSAGERIE EN TEMPS RÉEL (FIREBASE REALTIME DATABASE) ---
    function listenToChannelMessages(channelId) {
        const messagesRef = ref(database, `messages/${channelId}`);
        onValue(messagesRef, (snapshot) => {
            chatMessages.innerHTML = "";
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.values(data).forEach(msg => {
                    const line = document.createElement('div');
                    line.classList.add('chat-line');
                    
                    // Gestion du badge VIP/Vérifié Fufu et Badges sur le chat
                    let badgeCode = "";
                    if (msg.author.toLowerCase() === "fufu") {
                        badgeCode = ` <i class="fa-solid fa-circle-check" style="color:#0099e5;" title="Verified"></i><span class="web-badge" style="background:red;">Admin</span>`;
                    } else if (msg.badges) {
                        msg.badges.forEach(b => { badgeCode += ` <span class="web-badge">${b}</span>`; });
                    }

                    line.innerHTML = `<span class="chat-tag-bot">[WEB USER]</span> <span class="chat-author">${msg.author}</span>${badgeCode}: <span>${msg.text}</span>`;
                    chatMessages.appendChild(line);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

    btnSendMessage.addEventListener('click', sendTextMessage);
    chatInputText.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendTextMessage(); });

    async function sendTextMessage() {
        const text = chatInputText.value.trim();
        if(!text || !activeChannelId || !currentUserData) return;

        // On pousse le message sur Firebase et on demande au bot via l'API de le relayer sur le vrai Discord
        const msgData = {
            author: currentUserData.username,
            text: text,
            timestamp: Date.now(),
            badges: currentUserData.badges || []
        };

        await push(ref(database, `messages/${activeChannelId}`), msgData);
        chatInputText.value = "";

        // Relais API vers le vrai Discord
        fetch('/api-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sendMessage',
                channelId: activeChannelId,
                content: `[WEB USER] ${currentUserData.username}: ${text}`
            })
        }).catch(err => console.error(err));
    }

    // --- GESTION DES COMPTES AUTH (FIREBASE + SÉCURITÉ USERNAME) ---
    const btnRegister = document.getElementById('btn-register');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const authError = document.getElementById('auth-error');

    btnRegister.addEventListener('click', async () => {
        const user = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value.trim();
        if(!user || !pass) return;

        // Étape 1 : Vérifier si le pseudo unique existe déjà dans la Realtime Database
        const userCheck = await get(child(ref(database), `users/${user.toLowerCase()}`));
        if (userCheck.exists()) {
            authError.innerText = "Username already taken.";
            return;
        }

        // Étape 2 : Création du compte email/password fictif sur Firebase Auth
        try {
            const fakeEmail = `${user.toLowerCase()}@usmscord.retro`;
            const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
            
            // Profil de base inséré en DB
            const isFufu = user.toLowerCase() === "fufu";
            const newUserData = {
                username: user,
                uid: userCredential.user.uid,
                isAdmin: isFufu, // Fufu devient automatiquement web admin
                badges: isFufu ? ["Admin"] : []
            };

            await set(ref(database, `users/${user.toLowerCase()}`), newUserData);
            authError.innerText = "";
        } catch (err) {
            authError.innerText = "Error during registration.";
        }
    });

    btnLogin.addEventListener('click', async () => {
        const user = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value.trim();
        if(!user || !pass) return;

        try {
            const fakeEmail = `${user.toLowerCase()}@usmscord.retro`;
            await signInWithEmailAndPassword(auth, fakeEmail, pass);
            authError.innerText = "";
        } catch (err) {
            authError.innerText = "Invalid credentials.";
        }
    });

    btnLogout.addEventListener('click', () => { signOut(auth); });

    // Surveillance de l'état de connexion de l'utilisateur
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const emailPrefix = user.email.split('@')[0];
            const snapshot = await get(child(ref(database), `users/${emailPrefix}`));
            if(snapshot.exists()) {
                currentUserData = snapshot.val();
                
                document.getElementById('auth-logged-out').classList.add('hidden');
                document.getElementById('auth-logged-in').classList.remove('hidden');
                document.getElementById('current-user-display').innerText = currentUserData.username;
                
                // Affichage des icônes vectorielles Vérifié + Admin si Fufu
                const badgeSpan = document.getElementById('user-verified-badge');
                if(currentUserData.username.toLowerCase() === 'fufu') {
                    badgeSpan.innerHTML = ` <i class="fa-solid fa-circle-check" style="color:#0099e5;" title="Verified Profile"></i> <i class="fa-solid fa-user-shield" style="color:red;" title="Web Master"></i>`;
                } else {
                    badgeSpan.innerHTML = "";
                }

                // Déverrouillage des inputs de chat
                chatInputText.disabled = false;
                btnSendMessage.disabled = false;

                // Affichage conditionnel du bouton "Configure Website"
                if (currentUserData.isAdmin === true) {
                    btnConfigWebsite.classList.remove('hidden');
                } else {
                    btnConfigWebsite.classList.add('hidden');
                }
            }
        } else {
            currentUserData = null;
            document.getElementById('auth-logged-out').classList.remove('hidden');
            document.getElementById('auth-logged-in').classList.add('hidden');
            btnConfigWebsite.classList.add('hidden');
            chatInputText.disabled = true;
            btnSendMessage.disabled = true;
            switchView(viewProfile);
        }
    });

    // --- GESTION DES COMMANDES D'ADMINISTRATION RELAYÉES ---
    document.getElementById('btn-execute-mod').addEventListener('click', () => {
        const userId = document.getElementById('mod-target-id').value.trim();
        const action = document.getElementById('mod-action').value;
        if(!userId) return;

        fetch('/api-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, userId: userId })
        }).then(res => alert("Action dispatched to bot.")).catch(err => console.error(err));
    });

    document.getElementById('btn-give-badge').addEventListener('click', async () => {
        const targetUser = document.getElementById('badge-target-user').value.trim().toLowerCase();
        const badge = document.getElementById('badge-name').value.trim();
        if(!targetUser || !badge) return;

        const snap = await get(child(ref(database), `users/${targetUser}`));
        if(snap.exists()){
            const u = snap.val();
            if(!u.badges) u.badges = [];
            u.badges.push(badge);
            await set(ref(database, `users/${targetUser}`), u);
            alert("Badge added!");
        }
    });

    document.getElementById('btn-give-admin').addEventListener('click', async () => {
        const targetUser = document.getElementById('badge-target-user').value.trim().toLowerCase();
        if(!targetUser) return;

        const snap = await get(child(ref(database), `users/${targetUser}`));
        if(snap.exists()){
            const u = snap.val();
            u.isAdmin = true;
            await set(ref(database, `users/${targetUser}`), u);
            alert("User promoted to Web Admin!");
        }
    });

    // Sélecteur de langue standard
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            const flagImg = document.getElementById('current-flag');
            const flagUrls = { en: "https://flagcdn.com/16x12/us.png", fr: "https://flagcdn.com/16x12/fr.png", zh: "https://flagcdn.com/16x12/cn.png" };
            if (flagImg && flagUrls[currentLang]) flagImg.src = flagUrls[currentLang];
            if (allMembers.length > 0) renderList(allMembers);
        });
    }

    loadDiscordData();
});
