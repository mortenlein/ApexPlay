'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const tc = useTranslations('common');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => removeToast(id), 4500);
  }, [removeToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Announced politely: a marshal is looking at the floor, not at the corner of a screen. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-20 z-[300] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3"
      >
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
          const iconTone =
            toast.tone === 'success' ? 'text-success' : toast.tone === 'error' ? 'text-danger' : 'text-brand';
          return (
            <div key={toast.id} className={`mds-toast pointer-events-auto ${toast.tone}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 ${iconTone}`}>
                  <Icon size={18} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mds-name text-body font-bold">{toast.title}</p>
                  {toast.description ? (
                    <p className="mds-name mt-1 text-meta leading-relaxed text-fg-muted">{toast.description}</p>
                  ) : null}
                  {toast.actionLabel && toast.onAction ? (
                    <button
                      type="button"
                      onClick={toast.onAction}
                      className="mt-2 rounded-sm text-label font-bold uppercase tracking-widest text-brand hover:underline"
                    >
                      {toast.actionLabel}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={tc('close')}
                  onClick={() => removeToast(toast.id)}
                  className="mds-tap rounded-sm p-1 text-fg-subtle transition-colors hover:text-fg"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return {
    success: (title: string, description?: string, action?: { label: string; onAction: () => void }) =>
      context.pushToast({ title, description, tone: 'success', actionLabel: action?.label, onAction: action?.onAction }),
    error: (title: string, description?: string, action?: { label: string; onAction: () => void }) =>
      context.pushToast({ title, description, tone: 'error', actionLabel: action?.label, onAction: action?.onAction }),
    info: (title: string, description?: string, action?: { label: string; onAction: () => void }) =>
      context.pushToast({ title, description, tone: 'info', actionLabel: action?.label, onAction: action?.onAction }),
  };
}
