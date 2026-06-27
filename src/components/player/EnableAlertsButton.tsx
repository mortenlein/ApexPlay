'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = 'unsupported' | 'idle' | 'enabling' | 'enabled' | 'error';

/** Lets a signed-in player opt into web-push match alerts. Hidden when unsupported/unconfigured. */
export function EnableAlertsButton() {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported');
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub && Notification.permission === 'granted') setState('enabled');
      })
      .catch(() => {});
  }, []);

  const enable = async () => {
    setState('enabling');
    try {
      const keyRes = await fetch('/api/push/public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        // Push isn't configured on the server (no VAPID keys).
        setState('unsupported');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('idle');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? 'enabled' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'unsupported') return null;

  if (state === 'enabled') {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-success">
        <BellRing size={14} />
        Match alerts on
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={enable}
      disabled={state === 'enabling'}
    >
      {state === 'error' ? <BellOff size={14} /> : <Bell size={14} />}
      {state === 'enabling' ? 'Enabling…' : state === 'error' ? 'Try again' : 'Enable match alerts'}
    </Button>
  );
}
