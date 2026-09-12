import React from "react";
import Link from "next/link";
import { Gamepad2, LayoutDashboard, Trophy } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/route-auth";
import { getGameMetadata, teamSizeLabel } from "@/lib/games";
import { getTournamentStage, STAGE_META, type TournamentStage } from "@/lib/tournament-stage";
import { ACTIVE_STATUSES, DONE_STATUSES, LIVE_STATUSES, isLive } from "@/lib/match-status";
import { Badge, EmptyState, PageHeader, TournamentCard } from "@/components/ui";

// Reads the signed-in identity and the live tournament list on every request — a prerendered
// page would bake in one visitor's session and a stale bracket list.
export const dynamic = 'force-dynamic';

const LANDING_LIMIT = 9;
const FLOOR_LIMIT = 6;
const RESULT_LIMIT = 6;

const STAGE_TONE: Record<TournamentStage, "neutral" | "info" | "live" | "done"> = {
  DRAFT: "neutral",
  REGISTRATION: "info",
  LIVE: "live",
  COMPLETE: "done",
};

/** Only the columns a spectator is allowed to see — never serverIp/password, never a steamId. */
const MATCH_CARD_SELECT = {
  id: true,
  status: true,
  round: true,
  bracketType: true,
  bestOf: true,
  homeScore: true,
  awayScore: true,
  updatedAt: true,
  tournament: { select: { id: true, name: true } },
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
} as const;

function roundLabel(match: { round: number; bracketType: string | null }) {
  const bracket = (match.bracketType || "WINNERS").toUpperCase();
  if (bracket === "GRAND_FINAL") return "Grand final";
  if (bracket === "THIRD_PLACE") return "Third place";
  if (bracket === "LOSERS") return `Lower round ${match.round}`;
  return `Round ${match.round}`;
}

interface FloorMatch {
  id: string;
  status: string;
  round: number;
  bracketType: string | null;
  bestOf: number;
  homeScore: number;
  awayScore: number;
  tournament: { id: string; name: string };
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
}

const matchHref = (m: FloorMatch) => `/tournaments/${m.tournament.id}?tab=matches`;

/**
 * A live match, shaped like the scorebug it is: both names on one line with the score between
 * them, big enough to read standing up. This is the loudest thing the landing page renders.
 */
function LiveMatchCard({ match }: { match: FloorMatch }) {
  return (
    <Link
      href={matchHref(match)}
      className="mds-live-panel block p-5 transition-colors hover:border-line-hover"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="live">Live</Badge>
        <span className="mds-name text-meta font-semibold text-fg-subtle">
          {match.tournament.name} · {roundLabel(match)} · <span className="mds-numeric">Bo{match.bestOf}</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <span className="mds-name text-right text-lead text-fg">{match.homeTeam?.name || "TBD"}</span>
        <span className="mds-numeric rounded-sm bg-tint px-3 py-1 text-title font-bold text-live">
          {match.homeScore} – {match.awayScore}
        </span>
        <span className="mds-name text-lead text-fg">{match.awayTeam?.name || "TBD"}</span>
      </div>
    </Link>
  );
}

/** A called or finished match: compact, stacked, built to sit in a row of six. */
function MatchLine({ match, tone }: { match: FloorMatch; tone: "next" | "done" }) {
  const showScore = tone === "done";
  const homeWon = match.homeScore > match.awayScore;

  return (
    <Link
      href={matchHref(match)}
      className="mds-card block p-4 transition-colors hover:border-line-hover"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="mds-uppercase-label text-fg-subtle">{roundLabel(match)}</span>
        <span className="mds-numeric text-meta font-semibold text-fg-subtle">Bo{match.bestOf}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {[
          { name: match.homeTeam?.name, score: match.homeScore, won: showScore && homeWon },
          {
            name: match.awayTeam?.name,
            score: match.awayScore,
            won: showScore && match.awayScore > match.homeScore,
          },
        ].map((side, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <span className={`mds-name text-body ${side.won ? "text-fg" : "text-fg-muted"}`}>
              {side.name || "TBD"}
            </span>
            {showScore && (
              <span
                className={`mds-numeric text-lead font-bold ${side.won ? "text-success" : "text-fg-subtle"}`}
              >
                {side.score}
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mds-name mt-3 border-t border-line pt-2 text-meta text-fg-subtle">
        {match.tournament.name}
      </p>
    </Link>
  );
}

export default async function Home() {
  const [{ steamId, role }, tournaments, floorMatches, results] = await Promise.all([
    getSessionIdentity(),
    prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      take: LANDING_LIMIT,
      select: {
        id: true,
        name: true,
        game: true,
        format: true,
        teamSize: true,
        teams: { select: { id: true } },
        matches: { select: { status: true } },
      },
    }),
    // What is happening on the floor right now: live first, then the matches that have been
    // called. This is the reason a spectator opened the page.
    prisma.match.findMany({
      where: { status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { updatedAt: 'desc' },
      take: FLOOR_LIMIT * 2,
      select: MATCH_CARD_SELECT,
    }),
    prisma.match.findMany({
      where: { status: { in: [...DONE_STATUSES] }, winnerId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: RESULT_LIMIT,
      select: MATCH_CARD_SELECT,
    }),
  ]);

  const signedIn = Boolean(steamId);

  const liveMatches = floorMatches.filter((m) => isLive(m.status)).slice(0, FLOOR_LIMIT);
  const calledMatches = floorMatches
    .filter((m) => !isLive(m.status))
    .slice(0, Math.max(0, FLOOR_LIMIT - liveMatches.length));

  const cards = tournaments
    .map((t) => {
      const stage = getTournamentStage(t.teams, t.matches);
      const gameMeta = getGameMetadata(t.game);
      const done = t.matches.filter((m) => DONE_STATUSES.includes(String(m.status || '').toUpperCase())).length;
      return {
        id: t.id,
        name: t.name,
        stage,
        game: gameMeta?.name || t.game,
        format: t.format === "DOUBLE_ELIMINATION" ? "Double elim" : "Single elim",
        roster: teamSizeLabel(gameMeta, t.teamSize),
        teamCount: t.teams.length,
        progress: t.matches.length > 0 ? { done, total: t.matches.length } : undefined,
        liveCount: t.matches.filter((m) => LIVE_STATUSES.includes(String(m.status || '').toUpperCase())).length,
      };
    })
    // Live tournaments first: what is running now outranks what was created most recently.
    .sort((a, b) => (a.stage === "LIVE" ? 0 : 1) - (b.stage === "LIVE" ? 0 : 1));

  return (
    <div className="flex min-h-screen flex-col bg-page text-fg">
      <PageHeader
        eyebrow="CS2 LAN tournaments"
        title={
          <>
            Apex<span className="text-brand">Play</span>
          </>
        }
        subtitle="Run a LAN from sign-up to grand final: Steam registration, seeded brackets, live match control and an OBS overlay — one surface the whole room can follow."
        meta={
          liveMatches.length > 0 ? (
            <span className="inline-flex items-center gap-2 text-body font-semibold text-live">
              <span className="mds-dot is-live" aria-hidden />
              <span className="mds-tabular">{liveMatches.length}</span>
              &nbsp;
              {liveMatches.length === 1
                ? "match is being played right now"
                : "matches are being played right now"}
            </span>
          ) : (
            <span className="text-body font-semibold text-fg-subtle">
              Nothing is being played right now.
            </span>
          )
        }
        actions={
          <>
            {signedIn ? (
              <Link
                href="/dashboard"
                data-testid="landing-cta-dashboard"
                className="mds-btn-primary h-11 px-6 text-meta font-bold uppercase tracking-widest"
              >
                <LayoutDashboard size={15} aria-hidden />
                My dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                data-testid="landing-cta-login"
                className="mds-btn-primary h-11 px-6 text-meta font-bold uppercase tracking-widest"
              >
                <Gamepad2 size={15} aria-hidden />
                Sign in with Steam
              </Link>
            )}
            {role === "admin" && (
              <Link
                href="/admin"
                data-testid="landing-cta-organizer"
                className="mds-btn-secondary h-11 px-6 text-meta font-bold uppercase tracking-widest"
              >
                <Trophy size={15} aria-hidden />
                Organizer
              </Link>
            )}
          </>
        }
      />

      <main id="board" className="mds-container flex flex-1 flex-col gap-12 py-10">
        {/* ---- What is happening right now. Never rendered when nothing is. ---- */}
        {(liveMatches.length > 0 || calledMatches.length > 0) && (
          <section aria-labelledby="floor-heading" className="space-y-4">
            <div className="mds-section-head">
              <div className="flex items-center gap-2.5">
                {liveMatches.length > 0 && <span className="mds-dot is-live" aria-hidden />}
                <h2 id="floor-heading" className="mds-uppercase-label text-fg">
                  {liveMatches.length > 0 ? "Playing now" : "Called to station"}
                </h2>
              </div>
              {calledMatches.length > 0 && liveMatches.length > 0 && (
                <p className="mds-uppercase-label text-fg-subtle">
                  {calledMatches.length} more called to station
                </p>
              )}
            </div>

            {liveMatches.length > 0 && (
              <div className={`grid gap-3 ${liveMatches.length > 1 ? "xl:grid-cols-2" : ""}`}>
                {liveMatches.map((m) => (
                  <LiveMatchCard key={m.id} match={m} />
                ))}
              </div>
            )}

            {calledMatches.length > 0 && (
              <div className="mds-card-grid">
                {calledMatches.map((m) => (
                  <MatchLine key={m.id} match={m} tone="next" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---- The tournament board. ---- */}
        <section aria-labelledby="board-heading" className="flex flex-1 flex-col gap-4">
          <div className="mds-section-head">
            <div className="flex items-center gap-3">
              <h2 id="board-heading" className="mds-uppercase-label text-fg">
                Tournaments
              </h2>
              <Badge tone="neutral">
                <span className="mds-tabular">{tournaments.length}</span>&nbsp;listed
              </Badge>
            </div>
            <Link
              href="/tournaments"
              className="rounded-sm text-meta font-semibold text-fg-muted transition-colors hover:text-fg"
            >
              Browse all →
            </Link>
          </div>

          {cards.length === 0 ? (
            <EmptyState
              className="flex-1"
              icon={<Gamepad2 size={24} />}
              title="No tournaments yet"
              description={
                role === "admin"
                  ? "Create the first tournament from the organizer workspace."
                  : "Nothing is running right now. Check back when the LAN opens."
              }
              action={
                role === "admin" ? (
                  <Link
                    href="/admin"
                    className="mds-btn-primary h-10 px-5 text-label font-bold uppercase tracking-widest"
                  >
                    Open organizer
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="mds-card-grid">
              {cards.map((t) => (
                <li key={t.id}>
                  <TournamentCard
                    href={`/tournaments/${t.id}`}
                    name={t.name}
                    game={t.game}
                    format={t.format}
                    roster={t.roster}
                    teamCount={t.teamCount}
                    stageLabel={STAGE_META[t.stage].label}
                    stageTone={STAGE_TONE[t.stage]}
                    progress={t.progress}
                    liveCount={t.liveCount}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Results. Only exists once somebody has actually won something. ---- */}
        {results.length > 0 && (
          <section aria-labelledby="results-heading" className="space-y-4">
            <div className="mds-section-head">
              <h2 id="results-heading" className="mds-uppercase-label text-fg">
                Latest results
              </h2>
            </div>
            {/* Deliberately not a list: the tournament board above is the page's only <ul>,
                and the specs identify a tournament card by `li` + its name — a result card
                carries the same name and would make that locator ambiguous. */}
            <div className="mds-card-grid">
              {results.map((m) => (
                <MatchLine key={m.id} match={m} tone="done" />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-line py-6">
        <div className="mds-container flex flex-wrap items-center justify-between gap-3">
          <span className="font-brand text-body font-bold">
            Apex<span className="text-brand">Play</span>
          </span>
          <div className="flex items-center gap-4 text-meta font-semibold text-fg-muted">
            <Link href="/tournaments" className="rounded-sm transition-colors hover:text-fg">
              Tournaments
            </Link>
            {signedIn ? (
              <Link href="/dashboard" className="rounded-sm transition-colors hover:text-fg">
                My desk
              </Link>
            ) : (
              <Link href="/login" className="rounded-sm transition-colors hover:text-fg">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
