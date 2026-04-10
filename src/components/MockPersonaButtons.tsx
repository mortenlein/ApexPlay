'use client';

import { signIn } from 'next-auth/react';

const PERSONAS = [
  { id: 'marcus', label: 'Marcus' },
  { id: 'leo', label: 'Leo' },
  { id: 'sam', label: 'Sam' },
  { id: 'chloe', label: 'Chloe' },
  { id: 'toby', label: 'Toby' },
];

export function MockPersonaButtons({ callbackUrl }: { callbackUrl: string }) {
  if (process.env.NEXT_PUBLIC_MOCK_AUTH !== 'true') {
    return null;
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <p className="mds-uppercase-label text-center opacity-40">Mock personas</p>
      <div className="grid grid-cols-2 gap-3">
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            onClick={() => signIn('mock-user', { persona: persona.id, callbackUrl })}
            className="mds-btn-secondary h-11 px-4 text-xs font-bold uppercase tracking-widest"
            type="button"
            data-testid={`mock-persona-${persona.id}`}
          >
            {persona.label}
          </button>
        ))}
      </div>
    </div>
  );
}
