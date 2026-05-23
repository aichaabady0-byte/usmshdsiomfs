import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const DISCORD_TOKEN = "TON_TOKEN_BOT_ICI";
const GUILD_ID = "TON_ID_SERVEUR_ICI";
// ---------------------

const app = express();
app.use(cors());
app.use(express.static('public'));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

let memberList = [];

client.once('ready', async () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();
        
        memberList = members.map(m => ({
            id: m.id,
            username: m.user.username,
            nickname: m.displayName,
            avatar: m.user.displayAvatarURL({ dynamic: true, size: 128 }),
            roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name),
            joinedAt: m.joinedAt ? m.joinedAt.toLocaleDateString() : 'Inconnu',
            status: m.presence ? m.presence.status : 'offline'
        }));
        console.log(`${memberList.length} membres récupérés.`);
    } catch (error) {
        console.error("Erreur lors de la récupération des membres:", error);
    }
});

// API pour le front-end
app.get('/api/members', (req, res) => {
    res.json(memberList);
});

client.login(DISCORD_TOKEN);
app.listen(3000, () => console.log('Site dispo sur http://localhost:3000'));
