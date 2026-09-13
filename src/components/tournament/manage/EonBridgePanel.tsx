'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Radio, Copy, Check } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { apiRequest } from '@/lib/client-api';

interface BridgeStatus {
  enabled: boolean;
  token: string | null;
}

/** Activate the EON live-score bridge for this tournament and show the operator the
 * endpoint + token to paste into EON's summit-bridge config on the observer machine. */
export function EonBridgePanel({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('organizer.eon');
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = `${baseUrl}/api/webhooks/eon`;

  const load = () =>
    apiRequest<BridgeStatus>(`/api/tournaments/${tournamentId}/eon-bridge`).then(setStatus).catch(() => {});

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const act = async (action: 'enable' | 'disable' | 'rotate') => {
    setBusy(true);
    try {
      const r = await apiRequest<BridgeStatus>(`/api/tournaments/${tournamentId}/eon-bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setStatus(r);
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const Field = ({ label, value, k }: { label: string; value: string; k: string }) => (
    <div>
      <p className="mds-uppercase-label text-fg-subtle">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-sm border border-line bg-page px-2 py-1.5">
        <code className="flex-1 truncate font-mono text-[11px] text-brand">{value}</code>
        <button type="button" onClick={() => copy(value, k)} className="shrink-0 text-fg-subtle hover:text-fg">
          {copied === k ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-brand" />
          <h3 className="text-sm font-bold">{t('title')}</h3>
        </div>
        <Badge tone={status?.enabled ? 'ready' : 'neutral'}>{t(status?.enabled ? 'on' : 'off')}</Badge>
      </div>

      {status?.enabled && status.token ? (
        <>
          <Field label={t('endpoint')} value={endpoint} k="url" />
          <Field label={t('token')} value={status.token} k="token" />
          <p className="text-xs text-fg-muted">
            {t.rich('configHint', { code: (chunks) => <code className="font-mono">{chunks}</code> })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('rotate')}>{t('rotate')}</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => act('disable')}>{t('disable')}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-fg-muted">{t('pitch')}</p>
          <Button size="sm" disabled={busy} onClick={() => act('enable')}>
            {t(busy ? 'enabling' : 'enable')}
          </Button>
        </>
      )}
    </Card>
  );
}
