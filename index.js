// ==================== WEB SERVER FOR RENDER ====================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Shark Community Bot is Running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ==================== DISCORD BOT ====================
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1499821970273861712';
const CHANNEL_ID = '1494458371468951624';
const YOUR_DISCORD_ID = '889802159686840320';
const FALLBACK_API = 'https://servers-frontend.fivem.net/api/servers/single/67lzxd';
const ROLE_ID = '1500031144530546808'; 
const DB_FILE = './players.json';
const UPDATE_INTERVAL = 5 * 60 * 1000;
// ================================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// Normalize Name
function normalizeName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[\|\[\]\(\)\{\}\/\\<>_*~`]/g, ' ')
    .replace(/[^a-z0-9ก-๙\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

async function getFiveMPlayers() {
  try {
    const res = await fetch(FALLBACK_API);
    const json = await res.json();
    const players = json?.Data?.players || [];
    console.log(`✅ ดึงผู้เล่นสำเร็จ (${players.length} คน)`);
    return players;
  } catch (err) {
    console.error('❌ API Error:', err.message);
    return [];
  }
}

async function buildEmbed(guild) {
  const fivemPlayers = await getFiveMPlayers();
  const db = loadDB();

  await guild.members.fetch();
  let members = guild.members.cache.filter(m => !m.user.bot);

  if (ROLE_ID) members = members.filter(m => m.roles.cache.has(ROLE_ID));

  const online = [];
  const offline = [];

  for (const [, member] of members) {
    const rawName = db[member.id] ? db[member.id].fivemName : member.displayName;
    const nameToCheck = normalizeName(rawName);

    const matched = fivemPlayers.find(p => normalizeName(p.name) === nameToCheck);

    const displayLabel = db[member.id]
      ? `${member.displayName} (${db[member.id].fivemName})`
      : member.displayName;

    if (matched) {
      online.push(`• [ID ${matched.id}] ${displayLabel} 🟢`);
    } else {
      offline.push(`• ${displayLabel}`);
    }
  }

  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' });

  return new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('🦈 สถานะสมาชิก Shark Community')
    .addFields(
      { name: `🟢 ออนไลน์ (${online.length})`, value: online.length ? online.join('\n') : '• ไม่มีสมาชิกออนไลน์', inline: false },
      { name: `🔴 ออฟไลน์ (${offline.length})`, value: offline.length ? offline.join('\n') : '• ทุกคนออนไลน์!', inline: false },
      { name: '📊 สรุป', value: `🟢 **${online.length}** | 🔴 **${offline.length}** | รวม **${members.size}** คน`, inline: false }
    )
    .setFooter({ text: `อัปเดตล่าสุด: ${now}` })
    .setTimestamp();
}

let botMessageId = null;

async function updateStatus() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const guild = channel.guild;
    const embed = await buildEmbed(guild);

    if (botMessageId) {
      try { await (await channel.messages.fetch(botMessageId)).delete(); } catch {}
    }

    const msg = await channel.send({ embeds: [embed] });
    botMessageId = msg.id;
    console.log(`✅ อัปเดตสำเร็จ ${new Date().toLocaleTimeString('th-TH')}`);
  } catch (err) {
    console.error('❌ Update Error:', err.message);
  }
}

// Slash Commands
client.once('ready', async () => {
  console.log(`✅ Bot Online: ${client.user.tag}`);
  await updateStatus();
  setInterval(updateStatus, UPDATE_INTERVAL);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.user.id !== YOUR_DISCORD_ID) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ephemeral: true });
  }

  const db = loadDB();

  if (interaction.commandName === 'add') {
    const user = interaction.options.getUser('member');
    const fivemName = interaction.options.getString('fivem_name');
    db[user.id] = { fivemName };
    saveDB(db);
    await interaction.reply({ content: `✅ ผูก **${user.username}** → **${fivemName}**`, ephemeral: true });
    await updateStatus();
  }
});

client.login(TOKEN);
