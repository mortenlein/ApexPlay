"use client";

import React from "react";
import Image from "next/image";
import { Share2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatName } from "./match-labels";

interface TournamentHeroProps {
  tournament: any;
  teamsCount: number;
  matchesCount: number;
  liveMatchesCount: number;
  gameMeta: any;
  onShare: () => void;
}

/**
 * One compact identification bar, not a poster. The spectator came for the live match, so the
 * hero's job is to say which tournament this is and get out of the way — on a phone it is a
 * single band above the tabs instead of the ~700px of stock key art it used to be.
 */
export function TournamentHero({
  tournament,
  teamsCount,
  matchesCount,
  liveMatchesCount,
  gameMeta,
  onShare,
}: TournamentHeroProps) {
  const t = useTranslations("tournament");
  const tStage = useTranslations("stage");
  const canRegister = Boolean(tournament?.steamSignupEnabled) && !Boolean(tournament?.rosterLocked);
  const format = formatName(tournament?.format || tournament?.type, tStage);

  return (
    <header className="relative w-full shrink-0 overflow-hidden border-b border-line bg-card">
      {/* Game art as texture only, and only where there is room for it. */}
      {gameMeta?.bannerUrl ? (
        <div className="absolute inset-0 z-0 hidden lg:block" aria-hidden>
          <Image
            src={gameMeta.bannerUrl}
            fill
            className="object-cover opacity-[0.07] grayscale"
            alt=""
            style={{ objectPosition: gameMeta?.bannerPosition || "center" }}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card to-transparent" />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex max-w-content flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-10 lg:py-5">
        <div className="flex min-w-0 items-center gap-3 lg:gap-4">
          {gameMeta?.logoUrl ? (
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded border border-line bg-field p-1.5 sm:flex">
              <Image
                src={gameMeta.logoUrl}
                width={32}
                height={32}
                className="h-full w-full object-contain"
                alt={gameMeta?.name || tournament.game}
              />
            </div>
          ) : null}

          <div className="min-w-0">
            <h1 className="mds-name-lg m-0 text-xl leading-tight lg:text-[28px]">{tournament.name}</h1>
            <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-subtle">
              <span>{gameMeta?.name || tournament.game}</span>
              {format ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{format}</span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span className="mds-numeric">{t("hero.teams", { count: teamsCount })}</span>
              <span aria-hidden>·</span>
              <span className="mds-numeric">{t("hero.matches", { count: matchesCount })}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {liveMatchesCount > 0 && (
            <span className="mds-uppercase-label flex items-center gap-2 rounded-full border border-danger px-3 py-1 text-[10px] text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
              {t("hero.liveNow")}
            </span>
          )}
          <button onClick={onShare} className="mds-btn-secondary h-9 px-4 text-xs">
            <Share2 size={14} />
            {t("hero.share")}
          </button>
          {canRegister && (
            <Link href={`/tournaments/${tournament.id}/register`} className="mds-btn-primary h-9 px-4 text-xs">
              {t("hero.registerTeam")}
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
