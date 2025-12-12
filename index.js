require('dotenv').config();
const path = require('path'); 
const fs = require('fs');

// =======================
// 🔥 إضافة سيرفر UptimeRobot
// =======================
const express = require("express");
const server = express();

server.all("/", (req, res) => {
  res.send("Bot is alive!");
});

server.listen(3000, () => {
  console.log("🌐 UptimeRobot Server is Running on Port 3000");
});
// =======================
// نهاية إضافة UptimeRobot
// =======================

// استخدام fetch المدمج في Node.js 20
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    EmbedBuilder, 
    PermissionsBitField, 
    ChannelType, 
    ButtonBuilder, 
    ButtonStyle,
    SlashCommandBuilder,
    REST,
    Routes,
    AttachmentBuilder
} = require('discord.js');

const Canvas = require('@napi-rs/canvas'); 
const menuOptions = require('./config/menuOptions');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

const PREFIX = '!';

// ===== IDs حسب المطلوب =====
const STAFF_ROLE = '1446497581361270804';
const EVENT_ROLE = '1446499346031054889';
const STAFF_EXTRA_ROLE = '1446498169650151656';
const EVENT_EXTRA_ROLE = '1446499621928046702';
// =========================

const openTickets = new Map();
const votes = {}; 

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; 
const GUILD_ID = process.env.GUILD_ID; 

const commands = [
  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("إنشاء استبيان تصويت")
    .addStringOption(option =>
      option.setName("topic").setDescription("موضوع الاستبيان").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("choice1").setDescription("الخيار الأول").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("choice2").setDescription("الخيار الثاني").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("choice3").setDescription("الخيار الثالث (اختياري)").setRequired(false)
    )
    .addStringOption(option =>
      option.setName("choice4").setDescription("الخيار الرابع (اختياري)").setRequired(false)
    )
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✔ تم تسجيل أمر /poll");
  } catch (err) {
    console.log(err);
  }
}
registerCommands();

// ==================
// عند تشغيل البوت
// ==================
client.once('clientReady', () => {
    console.log(`Bot is online! Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} server(s)`);

    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=84992`;
    console.log('\n========================================');
    console.log('INVITE LINK (copy this):');
    console.log(inviteLink);
    console.log('========================================\n');

    client.user.setActivity('!help | REDLINE COMMUNITY', { type: 'WATCHING' });
});

// ===================
// الترحيب بالصورة مع النص في الرسالة فقط + بروفايل داخل الدائرة البيضاء
// ===================
client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.get('1448355120201863360'); 
    if (!channel) return;

    const canvasWidth = 1024;
    const canvasHeight = 450;

    const canvas = Canvas.createCanvas(canvasWidth, canvasHeight); 
    const ctx = canvas.getContext('2d');

    const backgroundPath = path.join(__dirname, 'redline.png');
    const backgroundBuffer = fs.readFileSync(backgroundPath);
    const background = await Canvas.loadImage(backgroundBuffer);

    ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);

    const centerX = 130; 
    const centerY = 215; 
    const radius = 105; 

    const avatarBuffer = await fetch(member.displayAvatarURL({ extension: 'png', size: 512 })).then(res => res.arrayBuffer());
    const avatar = await Canvas.loadImage(Buffer.from(avatarBuffer));

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();

    const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome.png' });

    channel.send({ 
        content: `∘ 𝑾𝑬𝑳𝑪𝑶𝑴𝑬 𝑻𝑶 𝙍𝙀𝘿 𝙇𝙄𝙉𝙀 𝘾𝙊𝙈𝙈𝙐𝙉𝙄𝙏𝙔\n∘ 𝗡𝗮𝗺𝗲: <@${member.id}>\n∘ 𝗛𝗮𝗽𝗽𝘆 𝗧𝗶𝗺𝗲!`, 
        files: [attachment] 
    });
});

// ===================
// استقبال الرسائل
// ===================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    try {
        switch (command) {
            case 'select':
            case 'menu':
            case 'rules':
                await handleSelectMenu(message);
                break;
            case 'help':
                await handleHelp(message);
                break;
            case 'ping':
                await handlePing(message);
                break;
            case 'update':
                await handleUpdate(message);
                break;
            case 'تكت':
                await handleTicketMenu(message);
                break;
            case 'dmall':
                {
                    const guild = message.guild;
                    if (!guild) return message.reply('❌ هذا الأمر يعمل فقط داخل السيرفر.');

                    await guild.members.fetch();

                    const embed = new EmbedBuilder()
                        .setTitle('🎉 𝐄𝐯𝐞𝐧𝐭・𝐀𝐧𝐧𝐨𝐮𝐧𝐜𝐞𝐦𝐞𝐧𝐭')
                        .setDescription("تم تغير الفعالية الى فعالية روكت ليق 2V2 🎉 للمشاركة راجع روم")
                        .setColor('#FF0000')
                        .setTimestamp()
                        .setFooter({ text: 'REDLINE COMMUNITY' });

                    let sentCount = 0;
                    for (const member of guild.members.cache.values()) {
                        if (!member.user.bot) {
                            try {
                                await member.send({ embeds: [embed] });
                                sentCount++;
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            } catch (err) {
                                console.log(`لا يمكن إرسال رسالة لـ ${member.user.tag}`);
                            }
                        }
                    }

                    return message.channel.send(`✔ تم إرسال الرسائل إلى ${sentCount} عضو/أعضاء.`);
                }
                break;
            default:
                break;
        }

        // ========================
        // نظام السلسلة الرقمية
        // ========================
        const sequenceChannelId = '1446513590181040259';
        if (message.channel.id === sequenceChannelId) {
            const sequenceState = message.client.sequenceState || { nextNumber: 1, lastUserId: null };
            message.client.sequenceState = sequenceState;

            const num = parseInt(message.content.trim());
            if (!isNaN(num)) {
                if (message.author.id === sequenceState.lastUserId) {
                    await message.channel.send(`❌ فشلت السلسلة! لا يمكنك إرسال رقمين متتابعين. إعادة ضبط السلسلة.`);
                    sequenceState.nextNumber = 1;
                    sequenceState.lastUserId = null;
                    return;
                }

                if (num !== sequenceState.nextNumber) {
                    await message.channel.send(`❌ فشلت السلسلة! الرقم المتوقع كان \`${sequenceState.nextNumber}\`. إعادة ضبط السلسلة.`);
                    sequenceState.nextNumber = 1;
                    sequenceState.lastUserId = null;
                    return;
                }

                sequenceState.nextNumber++;
                sequenceState.lastUserId = message.author.id;
                await message.react('✅');
            }
        }
    } catch (error) {
        console.error('Error handling command:', error);
        await message.reply({ content: 'حدث خطأ أثناء تنفيذ الأمر. حاول مرة أخرى.', flags: 64 });
    }
});

// ===================
// دوال القوانين
// ===================
async function handleSelectMenu(message) {
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('serverInfoSelect')
                .setPlaceholder('اختر ما تريد معرفته')
                .addOptions(menuOptions.map(opt => ({
                    label: opt.label,
                    value: opt.value,
                    description: opt.description,
                    emoji: opt.emoji
                })))
        );

    const embed = new EmbedBuilder()
        .setTitle('📋 القائمة')
        .setDescription('اختر خيار من القائمة لمعرفة القوانين.')
        .setColor('#FF0000')
        .setImage("https://media.discordapp.net/attachments/1411068154301644820/1448550438004592650/Blue_Futuristic_Artificial_Intelligence_Presentation_3.png");

    await message.channel.send({ embeds: [embed], components: [row] });
}

// ===================
// نظام التذاكر
// ===================
async function handleTicketMenu(message) {
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticketMenu')
                .setPlaceholder('اختر نوع التذكرة')
                .addOptions([
                    { label: 'استفسار', description: 'للاستفسارات العامة', value: 'استفسار', emoji: '❓' },
                    { label: 'تقديم على فعالية', description: 'للتقديم على الفعاليات', value: 'تقديم', emoji: '🎉' },
                    { label: 'شكوى ادارية', description: 'لرفع الشكاوى الادارية', value: 'شكوى', emoji: '⛔' }
                ])
        );

    const embed = new EmbedBuilder()
        .setTitle('🎫 نظام التذاكر')
        .setDescription('اختر نوع التذكرة التي تريد فتحها من القائمة أدناه.')
        .setColor('#FF0000')
        .setFooter({ text: 'REDLINE COMMUNITY' })
        .setTimestamp()
        .setImage("https://media.discordapp.net/attachments/1411068154301644820/1448550438508167310/Blue_Futuristic_Artificial_Intelligence_Presentation_4.png");

    await message.channel.send({ embeds: [embed], components: [row] });
}

// ===================
// التعامل مع التفاعلات
// ===================
client.on('interactionCreate', async interaction => {
    try {
        const user = interaction.user;
        const guild = interaction.guild;

        // ======== القوانين ========
        if (interaction.isStringSelectMenu() && interaction.customId === 'serverInfoSelect') {
            const selectedValue = interaction.values[0];
            const selected = menuOptions.find(option => option.value === selectedValue);

            if (selected) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`${selected.emoji} ${selected.label}`)
                    .setDescription(selected.fullDescription)
                    .setFooter({ text: 'REDLINE COMMUNITY' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], flags: 64 });
            } else {
                return interaction.reply({ content: 'الخيار غير موجود!', flags: 64 });
            }
        }

        // ======== تذاكر ========
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticketMenu') {
            let categoryId, channelName, ticketType, rolesToMention = [];

            switch (interaction.values[0]) {
                case 'استفسار':
                    categoryId = '1447912639735926866';
                    channelName = '❓ تكت استفسار';
                    ticketType = 'استفسار';
                    rolesToMention = [STAFF_ROLE, STAFF_EXTRA_ROLE];
                    break;
                case 'تقديم':
                    categoryId = '1447912721461940315';
                    channelName = '🎉 تكت تقديم فعالية';
                    ticketType = 'تقديم';
                    rolesToMention = [EVENT_ROLE, EVENT_EXTRA_ROLE];
                    break;
                case 'شكوى':
                    categoryId = '1447912783386509345';
                    channelName = '⛔ تكت شكوى ادارية';
                    ticketType = 'شكوى';
                    rolesToMention = [STAFF_ROLE, STAFF_EXTRA_ROLE];
                    break;
                default:
                    return interaction.reply({ content: 'حدث خطأ!', flags: 64 });
            }

            if (!openTickets.has(user.id)) openTickets.set(user.id, []);
            const existingBlocking = openTickets.get(user.id).find(t => t.type === ticketType && !t.archived);
            if (existingBlocking) {
                return interaction.reply({ content: `لديك بالفعل تكت من هذا النوع: <#${existingBlocking.channelId}>`, flags: 64 });
            }

            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
                ]
            });

            openTickets.get(user.id).push({ channelId: channel.id, type: ticketType, closed: false, archived: false });

            const closeButton = new ButtonBuilder()
                .setCustomId('closeTicket')
                .setLabel('اغلاق التكت !')
                .setStyle(ButtonStyle.Danger);

            const deleteButton = new ButtonBuilder()
                .setCustomId('deleteTicket')
                .setLabel('حذف التكت')
                .setStyle(ButtonStyle.Secondary);

            const componentsToSend = [new ActionRowBuilder().addComponents(closeButton, deleteButton)];

            const mentionsString = rolesToMention.map(r => `<@&${r}>`).join(' ');

            await channel.send({
                content: `هلا <@${user.id}> معك إدارة RED LINE كيف نقدر نساعدك؟\n${mentionsString}`,
                components: componentsToSend
            });

            return interaction.reply({ 
                content: `تم فتح التكت! يمكنك الوصول إليه هنا: <#${channel.id}>`, 
                flags: 64
            });
        }

        // ======== أغلاق وحذف التكت ========
        if (interaction.isButton() && interaction.customId === 'closeTicket') {
            const channel = interaction.channel;
            let found = null;
            for (const [uid, tickets] of openTickets.entries()) {
                const t = tickets.find(x => x.channelId === channel.id && !x.archived);
                if (t) { found = { ownerId: uid, ticket: t }; break; }
            }

            if (!found) return interaction.reply({ content: 'لا يمكنك إغلاق هذه التكت!', flags: 64 });
            if (found.ownerId !== interaction.user.id && !interaction.member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: 'فقط صاحب التكت أو الإدارة يمكنهم الإغلاق!', flags: 64 });
            if (found.ticket.closed) return interaction.reply({ content: 'لقد أغلقت هذه التكت بالفعل!', flags: 64 });

            found.ticket.closed = true;
            await channel.permissionOverwrites.edit(found.ownerId, { ViewChannel: false, SendMessages: false });

            return interaction.reply({ content: 'تم إغلاق التكت.', flags: 64 });
        }

        if (interaction.isButton() && interaction.customId === 'deleteTicket') {
            const member = interaction.member;
            const channel = interaction.channel;

            if (!member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: '❌ هذا الزر مخصص فقط للإدارة.', flags: 64 });

            let found = null;
            for (const [uid, tickets] of openTickets.entries()) {
                const t = tickets.find(x => x.channelId === channel.id && !x.archived);
                if (t) { found = { ownerId: uid, ticket: t }; break; }
            }
            if (!found) return interaction.reply({ content: 'هذه التكت غير معروفة.', flags: 64 });

            try {
                await interaction.reply({ content: '🗑️ جارٍ حذف التكت...', flags: 64 });
                await channel.delete();
                openTickets.set(found.ownerId, openTickets.get(found.ownerId).filter(t => t.channelId !== channel.id));
            } catch (err) {
                console.error('Delete error:', err);
            }
        }

        // ======== /poll ========
        if (interaction.isChatInputCommand() && interaction.commandName === "poll") {
            const topic = interaction.options.getString("topic");
            const c1 = interaction.options.getString("choice1");
            const c2 = interaction.options.getString("choice2");
            const c3 = interaction.options.getString("choice3");
            const c4 = interaction.options.getString("choice4");

            const embed = new EmbedBuilder()
                .setTitle("📊 استبيان جديد")
                .setDescription(`**${topic}**`)
                .setColor("Blue")
                .addFields(
                    { name: "1️⃣", value: c1, inline: false },
                    { name: "2️⃣", value: c2, inline: false }
                );
            if (c3) embed.addFields({ name: "3️⃣", value: c3, inline: false });
            if (c4) embed.addFields({ name: "4️⃣", value: c4, inline: false });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("vote1").setLabel("1️⃣").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("vote2").setLabel("2️⃣").setStyle(ButtonStyle.Primary)
            );
            if (c3) row.addComponents(new ButtonBuilder().setCustomId("vote3").setLabel("3️⃣").setStyle(ButtonStyle.Primary));
            if (c4) row.addComponents(new ButtonBuilder().setCustomId("vote4").setLabel("4️⃣").setStyle(ButtonStyle.Primary));

            await interaction.reply({ embeds: [embed], components: [row] });
        }

        // ======== تسجيل الأصوات ========
        if (interaction.isButton() && interaction.customId.startsWith("vote")) {
            const userId = interaction.user.id;
            const messageId = interaction.message.id;
            const voteId = interaction.customId;

            if (!votes[messageId]) {
                votes[messageId] = {
                    counts: { vote1: 0, vote2: 0, vote3: 0, vote4: 0 },
                    voters: new Set()
                };
            }

            if (votes[messageId].voters.has(userId)) {
                return interaction.reply({ content: '❌ لقد صوتت مسبقًا!', flags: 64 });
            }

            votes[messageId].voters.add(userId);
            votes[messageId].counts[voteId]++;

            const oldEmbed = interaction.message.embeds[0];
            const fields = [];

            const totalVotes = Object.values(votes[messageId].counts).reduce((a,b) => a+b, 0);

            oldEmbed.fields.forEach((field, index) => {
                const key = `vote${index + 1}`;
                const count = votes[messageId].counts[key] || 0;
                const percent = totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(1);
                fields.push({ name: field.name, value: `${field.value}\n✅ ${count} صوت (${percent}%)`, inline: false });
            });

            const newEmbed = EmbedBuilder.from(oldEmbed).setFields(fields);
            await interaction.message.edit({ embeds: [newEmbed] });

            return interaction.reply({ content: '✔ تم تسجيل صوتك!', flags: 64 });
        }

    } catch (err) {
        console.error('interaction handler error:', err);
        try { 
            await interaction.reply({ content: 'حدث خطأ داخلي. تواصل مع المطور.', flags: 64 }); 
        } catch(e){ }
    }
});

// ===================
// تسجيل الدخول
// ===================
if (!TOKEN) {
    console.error('ERROR: DISCORD_BOT_TOKEN is not set in environment variables!');
    process.exit(1);
}

client.login(TOKEN);
