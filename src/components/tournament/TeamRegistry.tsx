"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Users, Search, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface TeamRegistryProps {
  teams: any[];
  onViewTeam: (team: any) => void;
}

export function TeamRegistry({ teams, onViewTeam }: TeamRegistryProps) {
  const t = useTranslations("tournament");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");

  const filteredTeams = teams.filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const playerCount = teams.reduce((total: number, t: any) => total + (t.players?.length || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="m-0 text-2xl font-bold tracking-tight">{tCommon("teams")}</h2>
          {/* Counts, not a sentence that says nothing ("Verified participants currently…"). */}
          <p className="m-0 mt-1 text-sm text-fg-muted">
            {t.rich("registry.counts", {
              teams: teams.length,
              players: playerCount,
              n: (chunks) => <span className="mds-numeric">{chunks}</span>,
            })}
          </p>
        </div>
        <div className="group relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle transition-colors group-focus-within:text-brand" />
          <input
            type="text"
            placeholder={t("registry.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mds-input h-10 w-full !pl-10 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTeams.map((team: any) => (
          <div
            key={team.id}
            className="mds-card flex flex-col gap-4 p-5 transition-colors hover:border-brand"
          >
            <div className="flex items-start gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-line bg-field">
                {team.logoUrl ? (
                  <Image src={team.logoUrl} alt="" fill className="object-contain p-1.5" />
                ) : (
                  <Users size={16} className="absolute inset-0 m-auto text-fg-subtle" />
                )}
              </div>
              {/* min-w-0 + a wrapping name: the badge no longer gets pushed off the card edge. */}
              <div className="min-w-0 flex-1">
                <h3 className="mds-name-lg m-0 text-base leading-snug">{team.name}</h3>
                <p className="mds-uppercase-label m-0 mt-1 text-[10px]">
                  {team.seed
                    ? t.rich("registry.seed", {
                        seed: team.seed,
                        n: (chunks) => <span className="mds-numeric">{chunks}</span>,
                      })
                    : t("registry.seedEmpty")}
                </p>
              </div>
              <span className="mds-badge shrink-0 bg-brand-soft text-brand">
                {t("registry.playerBadge", { count: team.players?.length || 0 })}
              </span>
            </div>

            {/* Every player, seat first. A "+1" tile in place of the fifth player helped nobody. */}
            <ul className="m-0 list-none space-y-1.5 p-0">
              {team.players?.map((p: any, idx: number) => (
                <li
                  key={p.id || idx}
                  className="flex items-center gap-2 rounded-sm bg-field px-2 py-1.5"
                >
                  <span
                    className={`mds-numeric shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                      p.seating
                        ? "bg-brand-soft text-brand"
                        : "bg-line text-fg-subtle"
                    }`}
                  >
                    {p.seating || "—"}
                  </span>
                  <span className="mds-name min-w-0 flex-1 text-[12px] text-fg-muted">
                    {p.nickname || p.name}
                  </span>
                </li>
              ))}
              {!team.players?.length && (
                <li className="text-[12px] text-fg-subtle">{t("team.noPlayers")}</li>
              )}
            </ul>

            <button
              onClick={() => onViewTeam(team)}
              className="mds-btn-secondary mt-auto h-9 w-full text-xs"
            >
              {t("registry.details")}
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <p className="text-sm text-fg-muted">{t("registry.noMatch", { search })}</p>
      )}
    </div>
  );
}
