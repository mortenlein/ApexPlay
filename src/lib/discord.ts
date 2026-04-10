import { REST } from '@discordjs/rest';
import { Routes, APIEmbed } from 'discord-api-types/v10';
import prisma from '@/lib/prisma';

export interface MockNotification {
  id: string;
  timestamp: string;
  embed: APIEmbed;
  type: 'MATCH' | 'RESULT' | 'SIGNUP';
}

type AnnouncementType = 'MATCH' | 'RESULT' | 'SIGNUP';
type TournamentEmbed = APIEmbed & { tournamentId?: string };

class DiscordClient {
  private rest: REST | null = null;
  private channelId: string | null = null;
  private webhookUrl: string | null = null;

  constructor() {
    const token = process.env.DISCORD_BOT_TOKEN;
    this.channelId = process.env.DISCORD_CHANNEL_ID || null;
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || null;

    if (token) {
      this.rest = new REST({ version: '10' }).setToken(token);
    }
  }

  private async executeRealDelivery(embed: APIEmbed) {
    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });
        return true;
      } catch (error) {
        console.error('Discord Webhook error:', error);
      }
    }

    if (this.rest && this.channelId) {
      try {
        await this.rest.post(Routes.channelMessages(this.channelId), {
          body: { embeds: [embed] },
        });
        return true;
      } catch (error) {
        console.error('Discord REST error:', error);
      }
    }

    return false;
  }

  private async executeMockDelivery(embed: TournamentEmbed, type: AnnouncementType) {
    await prisma.notificationLog.create({
      data: {
        type,
        title: String(embed.title || 'Notification'),
        description: String(embed.description || ''),
        tournamentId: embed.tournamentId || null,
      },
    });

    console.log(`[STRATEGY 3 MOCK] ${type} notification intercepted:`, embed.title);
    return true;
  }

  private async send(embed: TournamentEmbed, type: AnnouncementType) {
    const isProdReady = Boolean(this.webhookUrl || (this.rest && this.channelId));
    const isMockMode = process.env.NEXT_PUBLIC_STRATEGY_3_MOCK === 'true';

    if (isMockMode || !isProdReady) {
      return this.executeMockDelivery(embed, type);
    }

    return this.executeRealDelivery(embed);
  }

  async announceMatch(data: {
    homeTeam: string;
    awayTeam: string;
    homePlayers?: string;
    awayPlayers?: string;
    round: number | string;
    tournamentName: string;
    tournamentId?: string;
    matchUrl: string;
    game: string;
  }) {
    const fields = [
      { name: 'Home', value: `**${data.homeTeam}**`, inline: true },
      { name: 'Status', value: 'vs', inline: true },
      { name: 'Away', value: `**${data.awayTeam}**`, inline: true },
    ];

    if (data.homePlayers) {
      fields.push({ name: `${data.homeTeam} roster`, value: `\`${data.homePlayers}\``, inline: false });
    }
    if (data.awayPlayers) {
      fields.push({ name: `${data.awayTeam} roster`, value: `\`${data.awayPlayers}\``, inline: false });
    }

    fields.push({ name: 'Platform', value: `\`${data.game}\``, inline: false });

    const embed: TournamentEmbed = {
      title: 'Match ready for players',
      description: `**${data.tournamentName}** · Round ${data.round}`,
      color: 0xff1744,
      fields,
      url: data.matchUrl,
      footer: { text: 'ApexPlay live operations' },
      timestamp: new Date().toISOString(),
      thumbnail: { url: 'https://i.imgur.com/8Q9Z8ZQ.png' },
      tournamentId: data.tournamentId,
    };

    await this.send(embed, 'MATCH');
  }

  async announceResult(data: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    tournamentName: string;
    tournamentId?: string;
    matchUrl: string;
    game: string;
  }) {
    const winner = data.homeScore > data.awayScore ? data.homeTeam : data.awayTeam;
    const embed: TournamentEmbed = {
      title: 'Result posted',
      description: `**${data.tournamentName}** · Official result`,
      color: 0x00c853,
      fields: [
        { name: 'Match', value: `**${data.homeTeam}** vs **${data.awayTeam}**`, inline: false },
        { name: 'Score', value: `**${data.homeScore} - ${data.awayScore}**`, inline: true },
        { name: 'Winner', value: `**${winner}**`, inline: true },
        { name: 'Platform', value: `\`${data.game}\``, inline: false },
      ],
      url: data.matchUrl,
      footer: { text: 'ApexPlay live operations' },
      timestamp: new Date().toISOString(),
      thumbnail: { url: 'https://i.imgur.com/8Q9Z8ZQ.png' },
      tournamentId: data.tournamentId,
    };

    await this.send(embed, 'RESULT');
  }

  async announceSignup(data: {
    playerName: string;
    teamName: string;
    tournamentName: string;
    tournamentId?: string;
    countryCode?: string | null;
  }) {
    const country = data.countryCode ? data.countryCode.toUpperCase() : 'N/A';
    const embed: TournamentEmbed = {
      title: 'Player registered',
      description: `Signup confirmed for **${data.tournamentName}**`,
      color: 0x0070f3,
      fields: [
        { name: 'Player', value: `**${data.playerName}**`, inline: true },
        { name: 'Team', value: `**${data.teamName}**`, inline: true },
        { name: 'Country', value: country, inline: true },
      ],
      footer: { text: 'ApexPlay signup update' },
      timestamp: new Date().toISOString(),
      tournamentId: data.tournamentId,
    };

    await this.send(embed, 'SIGNUP');
  }
}

const discordClient = new DiscordClient();

export const announceMatch = (data: any) => discordClient.announceMatch(data);
export const announceResult = (data: any) => discordClient.announceResult(data);
export const announceSignup = (data: any) => discordClient.announceSignup(data);

export default discordClient;
