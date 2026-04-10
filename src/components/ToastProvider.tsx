'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
      <div className="pointer-events-none fixed right-4 top-24 z-[300] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
          return (
            <div key={toast.id} className={`mds-toast pointer-events-auto ${toast.tone}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black tracking-tight">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-[var(--mds-text-muted)]">{toast.description}</p>
                  ) : null}
                  {toast.actionLabel && toast.onAction ? (
                    <button
                      type="button"
                      onClick={toast.onAction}
                      className="mt-2 text-[10px] font-black uppercase tracking-widest text-[var(--mds-action)] hover:underline"
                    >
                      {toast.actionLabel}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-md p-1 text-[var(--mds-text-subtle)] transition-colors hover:text-[var(--mds-text-primary)]"
                >
                  <X size={14} />
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
