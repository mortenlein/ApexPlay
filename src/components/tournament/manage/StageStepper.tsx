'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ArrowRight } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { getTournamentStage, STAGE_ORDER, type TournamentStage } from '@/lib/tournament-stage';

/**
 * DRAFT/REGISTRATION/LIVE/COMPLETE are shared vocabulary: the stage *name* comes from the
 * `stage` namespace (the same words the public badges use), and only the organizer-only
 * "what's next" hint and action live in this surface's own catalogue.
 */
const STAGE_KEY: Record<TournamentStage, string> = {
  DRAFT: 'draft',
  REGISTRATION: 'registration',
  LIVE: 'live',
  COMPLETE: 'complete',
};
const HINT_KEY: Record<TournamentStage, string> = {
  DRAFT: 'hintDraft',
  REGISTRATION: 'hintRegistration',
  LIVE: 'hintLive',
  COMPLETE: 'hintComplete',
};
const ACTION_KEY: Record<TournamentStage, string> = {
  DRAFT: 'actionDraft',
  REGISTRATION: 'actionRegistration',
  LIVE: 'actionLive',
  COMPLETE: 'actionComplete',
};

/**
 * Lifecycle stepper for the manage view: shows Draft → Registration → Live → Complete with
 * the current stage highlighted and a single "what's next" action.
 */
export function StageStepper({
  teams,
  matches,
  onAction,
}: {
  teams: any[];
  matches: any[];
  onAction: (stage: TournamentStage) => void;
}) {
  const t = useTranslations('organizer.stepper');
  const tStage = useTranslations('stage');
  const stage = getTournamentStage(teams, matches);
  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Wraps rather than overflowing: at 390px the four stages do not fit on one line. */}
      <ol className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
        {STAGE_ORDER.map((s, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          return (
            <React.Fragment key={s}>
              <li className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    done
                      ? 'bg-success/15 text-success'
                      : current
                        ? 'bg-brand text-white'
                        : 'bg-white/5 text-fg-subtle'
                  }`}
                >
                  {done ? <Check size={13} /> : i + 1}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    current ? 'text-fg' : done ? 'text-fg-muted' : 'text-fg-subtle'
                  }`}
                >
                  {tStage(STAGE_KEY[s])}
                </span>
              </li>
              {i < STAGE_ORDER.length - 1 && (
                <span className={`mx-1 hidden h-px flex-1 sm:block ${i < currentIndex ? 'bg-success/30' : 'bg-line'}`} />
              )}
            </React.Fragment>
          );
        })}
      </ol>

      <div className="flex items-center gap-4 lg:shrink-0">
        <p className="hidden text-xs text-fg-muted xl:block">{t(HINT_KEY[stage])}</p>
        <Button size="sm" variant={stage === 'COMPLETE' ? 'secondary' : 'primary'} onClick={() => onAction(stage)}>
          {t(ACTION_KEY[stage])}
          <ArrowRight size={14} />
        </Button>
      </div>
    </Card>
  );
}
