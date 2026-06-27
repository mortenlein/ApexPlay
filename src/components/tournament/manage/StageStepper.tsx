'use client';

import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  getTournamentStage,
  STAGE_ORDER,
  STAGE_META,
  type TournamentStage,
} from '@/lib/tournament-stage';

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
  const stage = getTournamentStage(teams, matches);
  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <ol className="flex flex-1 items-center gap-1">
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
                  {STAGE_META[s].label}
                </span>
              </li>
              {i < STAGE_ORDER.length - 1 && (
                <span className={`mx-1 h-px flex-1 ${i < currentIndex ? 'bg-success/30' : 'bg-line'}`} />
              )}
            </React.Fragment>
          );
        })}
      </ol>

      <div className="flex items-center gap-4 lg:shrink-0">
        <p className="hidden text-xs text-fg-muted xl:block">{STAGE_META[stage].hint}</p>
        <Button size="sm" variant={stage === 'COMPLETE' ? 'secondary' : 'primary'} onClick={() => onAction(stage)}>
          {STAGE_META[stage].action}
          <ArrowRight size={14} />
        </Button>
      </div>
    </Card>
  );
}
