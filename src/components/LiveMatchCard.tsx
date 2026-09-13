"use client";

import React from 'react';
import Image from 'next/image';
import { Trophy, Layout } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface LiveMatchCardProps {
  match: any;
  tournamentId: string;
  /** Stage this match belongs to ("Quarter-Finals"), from the caller that has every match. */
  stageName?: string;
}

function TeamRow({ team, score, leading }: { team: any; score: number; leading: boolean }) {
  const tCommon = useTranslations('common');

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-line bg-field">
        {team?.logoUrl ? (
          <Image src={team.logoUrl} alt="" fill className="object-contain p-1" />
        ) : (
          <Trophy size={14} className="absolute inset-0 m-auto text-fg-subtle" />
        )}
      </div>
      <span className="mds-name min-w-0 flex-1 text-sm text-fg">
        {team?.name || tCommon('tbd')}
      </span>
      <span
        className={`mds-numeric text-2xl font-bold ${
          leading ? 'text-fg' : 'text-fg-subtle'
        }`}
      >
        {score}
      </span>
    </div>
  );
}

/**
 * A live match as a scoreboard row-pair: name left, score right, so a club name has the whole
 * card width and never has to become "Tea…". The old card put a 130px logo box on either side
 * of the score, which on a phone left about 40px for each name.
 */
const LiveMatchCard: React.FC<LiveMatchCardProps> = ({ match, tournamentId, stageName }) => {
  const t = useTranslations('tournament');
  const tStatus = useTranslations('status');
  const meta = [stageName, match.bestOf ? `BO${match.bestOf}` : null].filter(Boolean).join(' · ');

  return (
    <div className="mds-card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="mds-uppercase-label text-[10px]">{meta}</span>
        <span className="mds-uppercase-label flex items-center gap-2 rounded-full border border-danger px-2.5 py-0.5 text-[10px] text-danger">
          <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
          {tStatus('live')}
        </span>
      </div>

      <div className="space-y-3">
        <TeamRow team={match.homeTeam} score={match.homeScore} leading={match.homeScore >= match.awayScore} />
        <TeamRow team={match.awayTeam} score={match.awayScore} leading={match.awayScore >= match.homeScore} />
      </div>

      {/* Honest destination: the bracket tab of this page. (The old "Watch Stream" button led to
          the transparent OBS overlay; nothing in the schema holds a stream URL.) */}
      <Link
        href={`/tournaments/${tournamentId}?tab=bracket`}
        className="mds-btn-secondary h-9 w-full text-xs"
      >
        <Layout size={14} />
        {t('bracket.open')}
      </Link>
    </div>
  );
};

export default LiveMatchCard;
