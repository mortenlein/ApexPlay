import { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    REST, 
    Routes, 
    EmbedBuilder 
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables for the standalone script
dotenv.config();

const prisma = new PrismaClient();

const commands = [
    new SlashCommandBuilder()
        .setName('nextgame')
        .setDescription('Get information about your next scheduled match'),
    new SlashCommandBuilder()
        .setName('current')
        .setDescription('Get information about the current tournament status and bracket')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

const registerCommands = async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_CLIENT_ID!, 
                process.env.DISCORD_GUILD_ID!
            ),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ],
});

client.on('ready', () => {
    console.log(`Command Bot logged in as ${client.user?.tag}!`);
    registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'nextgame') {
        await interaction.deferReply();
        
        try {
            // Find user by Discord ID
            const discordId = interaction.user.id;
            const user = await prisma.user.findFirst({
                where: {
                    accounts: {
                        some: {
                            provider: 'discord',
                            providerAccountId: discordId
                        }
                    }
                },
                include: {
                    players: {
                        include: {
                            team: {
                                include: {
                                    tournament: true,
                                    matchHome: {
                                        where: { status: 'PENDING' },
                                        orderBy: { round: 'asc' },
                                        take: 1,
                                        include: { awayTeam: true, homeTeam: true }
                                    },
                                    matchAway: {
                                        where: { status: 'PENDING' },
                                        orderBy: { round: 'asc' },
                                        take: 1,
                                        include: { homeTeam: true, awayTeam: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!user || user.players.length === 0) {
                await interaction.editReply('You are not registered for any tournaments or your Discord account is not linked to your profile.');
                return;
            }

            const activePlayer = user.players[0];
            const homeMatch = activePlayer.team.matchHome[0];
            const awayMatch = activePlayer.team.matchAway[0];

            let nextMatch = null;
            if (homeMatch && awayMatch) {
                nextMatch = homeMatch.round <= awayMatch.round ? homeMatch : awayMatch;
            } else {
                nextMatch = homeMatch || awayMatch;
            }

            if (!nextMatch) {
                await interaction.editReply(`No upcoming match found for team **${activePlayer.team.name}** in **${activePlayer.team.tournament.name}**.`);
                return;
            }

            const opponent = nextMatch.homeTeam?.id === activePlayer.team.id ? nextMatch.awayTeam?.name : nextMatch.homeTeam?.name;

            const embed = new EmbedBuilder()
                .setTitle('🕒 Your Next Scheduled Match')
                .setColor(0x4318FF)
                .setDescription(`Tournament: **${activePlayer.team.tournament.name}**`)
                .addFields(
                    { name: 'Your Team', value: `**${activePlayer.team.name}**`, inline: true },
                    { name: 'vs', value: '⚡', inline: true },
                    { name: 'Opponent', value: `**${opponent || 'TBD'}**`, inline: true },
                    { name: 'Round', value: `Round ${nextMatch.round}`, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching next game:', error);
            await interaction.editReply('There was an error while fetching your match information.');
        }
    }

    if (interaction.commandName === 'current') {
        await interaction.deferReply();
        
        try {
            const tournament = await prisma.tournament.findFirst({
                orderBy: { createdAt: 'desc' }
            });

            if (!tournament) {
                await interaction.editReply('No active tournament found.');
                return;
            }

            const baseUrl = process.env.NEXTAUTH_URL;
            const bracketUrl = `${baseUrl}/tournaments/${tournament.id}`;

            const embed = new EmbedBuilder()
                .setTitle(`📊 Current Status: ${tournament.name}`)
                .setColor(0x4318FF)
                .setDescription(`Game: **${tournament.game}**\nCategory: **${tournament.category}**`)
                .addFields(
                    { name: 'Tournament Bracket', value: `[View Full Bracket & Standings](${bracketUrl})` }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching current info:', error);
            await interaction.editReply('There was an error while fetching the tournament status.');
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
