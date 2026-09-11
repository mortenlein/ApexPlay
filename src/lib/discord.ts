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

/**
 * Two announcements with the same (type, title, tournamentId) inside this window are the same
 * call, so only the first one is logged. Retries, double-clicks on "call match", and callers
 * that both log and announce (notify.ts) therefore can't stack up duplicate rows in the
 * marshal feed.
 */
const LOG_DEDUPE_WINDOW_MS = 10_000;

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

  private async executeRealDelivery(embed: TournamentEmbed) {
    // Strip our internal `tournamentId` — Discord rejects the whole embed (HTTP 400
    // "Invalid Form Body") if it carries any field outside the embed schema.
    const { tournamentId: _ignored, ...discordEmbed } = embed;

    if (this.webhookUrl) {
      try {
        const res = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [discordEmbed] }),
        });
        if (!res.ok) {
          console.error(`Discord webhook rejected (${res.status}): ${await res.text().catch(() => '')}`);
          return false;
        }
        return true;
      } catch (error) {
        console.error('Discord webhook error:', error);
        return false;
      }
    }

    if (this.rest && this.channelId) {
      try {
        await this.rest.post(Routes.channelMessages(this.channelId), {
          body: { embeds: [discordEmbed] },
        });
        return true;
      } catch (error) {
        console.error('Discord REST error:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Record the announcement in NotificationLog. This is what feeds the marshal board's
   * "Match calls" list and the admin timeline, so it has to happen whether or not a real
   * Discord webhook is configured — it used to only run in mock mode, which left both
   * surfaces empty in production. Never throws: a failed log must not fail the delivery.
   */
  private async writeLog(embed: TournamentEmbed, type: AnnouncementType) {
    const title = String(embed.title || 'Notification');
    const description = String(embed.description || '');
    const tournamentId = embed.tournamentId || null;
    try {
      // Same announcement twice inside the window (double-click, notify + announce) → one row.
      // The description is part of the key: "Match ready for players" is the same title for
      // every match, so two different matches called back-to-back must both get a row.
      const duplicate = await prisma.notificationLog.findFirst({
        where: {
          type,
          title,
          description,
          tournamentId,
          createdAt: { gte: new Date(Date.now() - LOG_DEDUPE_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (duplicate) return;

      await prisma.notificationLog.create({
        data: {
          type,
          title,
          description,
          tournamentId,
        },
      });
    } catch (error) {
      console.warn('[Discord] NotificationLog write failed:', error);
    }
  }

  private async send(embed: TournamentEmbed, type: AnnouncementType) {
    const isProdReady = Boolean(this.webhookUrl || (this.rest && this.channelId));
    const isMockMode = process.env.NEXT_PUBLIC_STRATEGY_3_MOCK === 'true';

    // Log first, always — the in-app feeds are the primary channel; Discord is the extra one.
    await this.writeLog(embed, type);

    if (isMockMode || !isProdReady) {
      console.log(`[STRATEGY 3 MOCK] ${type} notification intercepted:`, embed.title);
      return true;
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
      // Teams are in the description on purpose: the in-app feed (marshal board) shows title +
      // description only, and the 10s log dedupe keys on them — two matches called back-to-back
      // in the same round must both show up.
      description: `**${data.homeTeam}** vs **${data.awayTeam}** · ${data.tournamentName} · Round ${data.round}`,
      color: 0xff1744,
      fields,
      url: data.matchUrl,
      footer: { text: 'ApexPlay live operations' },
      timestamp: new Date().toISOString(),
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
      description: `**${data.homeTeam}** ${data.homeScore}:${data.awayScore} **${data.awayTeam}** · ${data.tournamentName} · Official result`,
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
      tournamentId: data.tournamentId,
    };

    await this.send(embed, 'RESULT');
  }

  /** A single tournament-level announcement (e.g. "bracket is live"), not per-match. */
  async announceTournamentUpdate(data: {
    title: string;
    description: string;
    tournamentId?: string;
    url?: string;
  }) {
    const embed: TournamentEmbed = {
      title: data.title,
      description: data.description,
      color: 0x0070f3,
      url: data.url,
      footer: { text: 'ApexPlay' },
      timestamp: new Date().toISOString(),
      tournamentId: data.tournamentId,
    };
    await this.send(embed, 'MATCH');
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
export const announceTournamentUpdate = (data: any) => discordClient.announceTournamentUpdate(data);
export const announceSignup = (data: any) => discordClient.announceSignup(data);

export default discordClient;
