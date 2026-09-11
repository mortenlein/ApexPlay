import React from "react";
import Link from "next/link";
import { ArrowRight, Gamepad2, LayoutDashboard, Trophy, Users } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/route-auth";
import { getGameMetadata, teamSizeLabel } from "@/lib/games";
import { getTournamentStage, STAGE_META, type TournamentStage } from "@/lib/tournament-stage";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

// Reads the signed-in identity and the live tournament list on every request — a prerendered
// page would bake in one visitor's session and a stale bracket list.
export const dynamic = 'force-dynamic';

const LANDING_LIMIT = 9;

const STAGE_TONE: Record<TournamentStage, "neutral" | "info" | "live" | "done"> = {
  DRAFT: "neutral",
  REGISTRATION: "info",
  LIVE: "live",
  COMPLETE: "done",
};

export default async function Home() {
  const [{ steamId, role }, tournaments] = await Promise.all([
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
  ]);

  const signedIn = Boolean(steamId);

  return (
    <div className="min-h-screen bg-page text-fg">
      <PageHeader
        eyebrow="CS2 LAN tournaments"
        title={
          <>
            Apex<span className="text-brand">Play</span>
          </>
        }
        subtitle="Run a LAN from sign-up to grand final: Steam registration, seeded brackets, live match control and an OBS overlay — one surface the whole room can follow."
        actions={
          <>
            {signedIn ? (
              <Link
                href="/dashboard"
                data-testid="landing-cta-dashboard"
                className="mds-btn-primary h-11 px-6 text-xs font-black uppercase tracking-widest"
              >
                <LayoutDashboard size={15} />
                My dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                data-testid="landing-cta-login"
                className="mds-btn-primary h-11 px-6 text-xs font-black uppercase tracking-widest"
              >
                <Gamepad2 size={15} />
                Sign in with Steam
              </Link>
            )}
            {role === "admin" && (
              <Link
                href="/admin"
                data-testid="landing-cta-organizer"
                className="mds-btn-secondary h-11 px-6 text-xs font-black uppercase tracking-widest"
              >
                <Trophy size={15} />
                Organizer
              </Link>
            )}
          </>
        }
      />

      <main className="mds-container space-y-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <h2 className="mds-uppercase-label text-fg-subtle">Tournaments</h2>
            <Badge tone="neutral">{tournaments.length} listed</Badge>
          </div>
          <Link
            href="/tournaments"
            className="text-xs font-semibold text-fg-muted transition-colors hover:text-fg"
          >
            Browse all →
          </Link>
        </div>

        {tournaments.length === 0 ? (
          <EmptyState
            icon={<Gamepad2 size={26} />}
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
                  className="mds-btn-primary h-10 px-5 text-[10px] font-black uppercase tracking-widest"
                >
                  Open organizer
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => {
              const stage = getTournamentStage(t.teams, t.matches);
              const gameMeta = getGameMetadata(t.game);
              return (
                <li key={t.id}>
                  <Link href={`/tournaments/${t.id}`} className="block h-full">
                    <Card interactive className="flex h-full flex-col justify-between gap-4 p-5">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-brand text-lg font-bold leading-tight">{t.name}</h3>
                          <Badge tone={STAGE_TONE[stage]}>{STAGE_META[stage].label}</Badge>
                        </div>
                        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-fg-muted">
                          <div className="flex items-center gap-1.5">
                            <dt className="sr-only">Game</dt>
                            <Gamepad2 size={13} className="text-brand" />
                            <dd>{gameMeta?.name || t.game}</dd>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <dt className="sr-only">Format</dt>
                            <Trophy size={13} className="text-fg-subtle" />
                            <dd>
                              {t.format === "DOUBLE_ELIMINATION" ? "Double elim" : "Single elim"}
                              {" · "}
                              {teamSizeLabel(gameMeta, t.teamSize)}
                            </dd>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <dt className="sr-only">Teams</dt>
                            <Users size={13} className="text-fg-subtle" />
                            <dd>
                              {t.teams.length} {t.teams.length === 1 ? "team" : "teams"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex items-center justify-between border-t border-line pt-3 text-sm font-semibold">
                        <span>Open tournament</span>
                        <ArrowRight size={16} className="text-fg-subtle" />
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
