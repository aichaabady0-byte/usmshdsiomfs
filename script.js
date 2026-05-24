import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, push, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    
    const usersList = document.getElementById('users-list');
    const detailsBox = document.getElementById('details-box');
    const langSelect = document.getElementById('lang-select');
    const channelsTree = document.getElementById('channels-tree');
    
    const viewProfile = document.getElementById('view-profile');
    const viewChat = document.getElementById('view-chat');
    const viewAdmin = document.getElementById('view-admin');
    const btnConfigWebsite = document.getElementById('btn-config-website');

    const chatMessages = document.getElementById('chat-messages');
    const chatInputText = document.getElementById('chat-input-text');
    const btnSendMessage = document.getElementById('btn-send-message');
    const activeChannelName = document.getElementById('active-channel-name');

    let allMembers = [];
    let currentLang = 'en';
    let activeChannelId = null;
    let currentUserData = null;
    
    let auth, database;

   // CONFIGURATION FIREBASE (À remplir avec tes vraies clés de ta console Firebase)
    const firebaseConfig = {
        apiKey: "AIzaSyD3l4bnRhUUXjYMkXHcQPZpfocCVZWMjOg",
        authDomain: "usmscord.firebaseapp.com",
        databaseURL: "https://usmscord-default-rtdb.firebaseio.com",
        projectId: "usmscord",
        storageBucket: "usmscord.firebasestorage.app",
        messagingSenderId: "1035262779396",
        appId: "1:1035262779396:web:3802738f0f998834681551"
    };

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);

    // Sidebar Onglets
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    if (btnConfigWebsite) {
        btnConfigWebsite.addEventListener('click', () => switchView(viewAdmin));
    }

    function switchView(targetView) {
        if (viewProfile) viewProfile.classList.add('hidden');
        if (viewChat) viewChat.classList.add('hidden');
        if (viewAdmin) viewAdmin.classList.add('hidden');
        if (targetView) targetView.classList.remove('hidden');
    }

    const translations = {
        en: { tagline: "Broadcast Yourself™", loading: "Loading...", noRole: "No role", status: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" } },
        fr: { tagline: "Broadcast Yourself™", loading: "Chargement...", noRole: "Aucun rôle", status: { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger", offline: "Hors ligne" } },
        zh: { tagline: "Broadcast Yourself™", loading: "正在加载...", noRole: "无身份组", status: { online: "在线", idle: "闲置", dnd: "请勿打扰", offline: "离线" } }
    };

    function listenToGlobalData() {
        if (!database) return;

        // 1. Infos du Serveur (Titre de l'application dynamique)
        onValue(ref(database, 'serverInfo'), (snapshot) => {
            if (snapshot.exists()) {
                const info = snapshot.val();
                const titleEl = document.querySelector('.logo-area h1') || document.querySelector('header h1');
                if (titleEl) titleEl.innerText = `${info.name} (${info.memberCount} membres)`;
            }
        });

        // 2. Charger les Salons Discord
        onValue(ref(database, 'channels'), (snapshot) => {
            if (snapshot.exists()) {
                renderChannels(Object.values(snapshot.val()));
            }
        });

        // 3. NOUVEAU : Charger les VRAIS membres Discord envoyés par le bot
        onValue(ref(database, 'discordMembers'), (snapshot) => {
            if (snapshot.exists()) {
                allMembers = Object.values(snapshot.val());
                renderList(allMembers);
            } else {
                if (usersList) usersList.innerHTML = `<li style="padding:10px;color:#888;">En attente de la synchro du bot...</li>`;
            }
        });
    }

    function renderChannels(channels) {
        if (!channelsTree) return;
        channelsTree.innerHTML = "";
        const categories = channels.filter(c => c.type === 4).sort((a,b) => a.position - b.position);
        const textChannels = channels.filter(c => c.type === 0).sort((a,b) => a.position - b.position);

        categories.forEach(cat => {
            const catDiv = document.createElement('div');
            catDiv.classList.add('category-row');
            catDiv.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${cat.name}`;
            channelsTree.appendChild(catDiv);

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
        if (activeChannelName) activeChannelName.innerText = channel.name;
        switchView(viewChat);
        listenToChannelMessages(channel.id);
    }

    function renderList(members) {
        if (!usersList) return;
        usersList.innerHTML = ""; 
        members.forEach(member => {
            const li = document.createElement('li');
            li.classList.add('user-item');
            const mainRoleName = member.roles && member.roles.length > 0 ? member.roles[0].name : translations[currentLang].noRole;
            const mainRoleColor = member.roles && member.roles.length > 0 ? member.roles[0].color : "#888";

            li.innerHTML = `
                <div class="avatar-container">
                    <img class="mini-avatar" src="${member.avatar}" alt="avatar">
                    <span class="status-dot ${member.status}"></span>
                </div>
                <div class="user-info">
                    <span class="nickname" style="color: ${mainRoleColor === '#000000' ? '#fff' : mainRoleColor};">${member.nickname}</span>
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
        
        const rolesHtml = member.roles && member.roles.length > 0 
            ? member.roles.map(role => `<span class="discord-role" style="background-color: ${role.color === '#000000' ? '#5865F2' : role.color}; color: #fff;">${role.name}</span>`).join(' ')
            : `<span>${t.noRole}</span>`;

        detailsBox.innerHTML = `
            <div class="profile-header">
                <img class="big-avatar" src="${member.avatar}" alt="Avatar">
                <div class="profile-title"><h2>${member.nickname}</h2><span>@${member.username}</span></div>
            </div>
            <div class="info-row"><span class="info-label">Statut Discord:</span> <strong class="status-text ${member.status}">${t.status[member.status] || member.status}</strong></div>
            <div class="info-row"><span class="info-label">Rôles Discord:</span><div class="roles-container">${rolesHtml}</div></div>
        `;
    }

    function listenToChannelMessages(channelId) {
        if (!chatMessages) return;
        onValue(ref(database, `messages/${channelId}`), (snapshot) => {
            chatMessages.innerHTML = "";
            if (snapshot.exists()) {
                Object.values(snapshot.val()).forEach(msg => {
                    const line = document.createElement('div');
                    line.classList.add('chat-line');
                    line.innerHTML = `<span class="chat-tag-bot">[WEB]</span> <span class="chat-author" style="font-weight:bold;">${msg.author}</span>: <span>${msg.text}</span>`;
                    chatMessages.appendChild(line);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

    if (btnSendMessage) btnSendMessage.addEventListener('click', sendTextMessage);
    if (chatInputText) chatInputText.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendTextMessage(); });

    async function sendTextMessage() {
        if(!chatInputText || !chatInputText.value.trim() || !activeChannelId || !currentUserData) return;
        await push(ref(database, `messages/${activeChannelId}`), {
            author: currentUserData.username,
            text: chatInputText.value.trim(),
            timestamp: Date.now()
        });
        chatInputText.value = "";
    }

    // Auth 
    const btnRegister = document.getElementById('btn-register');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const authError = document.getElementById('auth-error');

    if (btnRegister) {
        btnRegister.addEventListener('click', async () => {
            const user = document.getElementById('auth-username').value.trim();
            const pass = document.getElementById('auth-password').value.trim();
            if(!user || !pass) return;
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, `${user.toLowerCase()}@usmscord.retro`, pass);
                await set(ref(database, `users/${user.toLowerCase()}`), { username: user, uid: userCredential.user.uid });
            } catch (err) { if (authError) authError.innerText = "Erreur inscription."; }
        });
    }

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const user = document.getElementById('auth-username').value.trim();
            const pass = document.getElementById('auth-password').value.trim();
            if(!user || !pass) return;
            try { await signInWithEmailAndPassword(auth, `${user.toLowerCase()}@usmscord.retro`, pass); }
            catch (err) { if (authError) authError.innerText = "Identifiants invalides."; }
        });
    }

    if (btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

    function setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            const loggedOutDiv = document.getElementById('auth-logged-out');
            const loggedInDiv = document.getElementById('auth-logged-in');
            const userDisplay = document.getElementById('current-user-display');

            if (user) {
                const snap = await get(child(ref(database), `users/${user.email.split('@')[0]}`));
                if(snap.exists()) {
                    currentUserData = snap.val();
                    if (loggedOutDiv) loggedOutDiv.classList.add('hidden');
                    if (loggedInDiv) loggedInDiv.classList.remove('hidden');
                    if (userDisplay) userDisplay.innerText = currentUserData.username;
                    if (chatInputText) chatInputText.disabled = false;
                    if (btnSendMessage) btnSendMessage.disabled = false;
                }
            } else {
                currentUserData = null;
                if (loggedOutDiv) loggedOutDiv.classList.remove('hidden');
                if (loggedInDiv) loggedInDiv.classList.add('hidden');
                if (chatInputText) chatInputText.disabled = true;
                if (btnSendMessage) btnSendMessage.disabled = true;
                switchView(viewProfile);
            }
        });
    }

    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            if (allMembers.length > 0) renderList(allMembers);
        });
    }

    setupAuthListener();
    listenToGlobalData();
});
