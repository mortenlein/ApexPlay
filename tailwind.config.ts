import type { Config } from "tailwindcss";

/**
 * Summit design tokens.
 *
 * The single source of truth for actual values is the CSS custom properties in
 * src/app/globals.css (so light/dark theming lives in one place). Tailwind here just
 * exposes them as semantic utilities — e.g. `bg-card`, `text-fg-muted`, `border-line`,
 * `bg-brand`, `text-label` — so components stop hand-writing `bg-[var(--mds-card)]`.
 *
 * THE RULE (see design.md §2): never write `var(--mds-*)` or a raw hex inside a component.
 * Every token below has a utility; if something you need is missing, add it *here* rather
 * than reaching past the layer. An inline `text-[var(--mds-text-muted)]` is invisible to a
 * token change and has to be hunted by hand — which is exactly the state this table ends.
 */
const config: Config = {
    darkMode: ["class", '[data-theme="dark"]'],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Every token below is wrapped in color-mix so Tailwind's alpha modifiers
                // (`bg-danger/15`, `border-brand/30`) actually compile. A bare `var(--x)` value
                // makes Tailwind emit NOTHING for the /alpha variant — the tint silently
                // disappears instead of failing loudly. With <alpha-value> substituted as 1 by
                // default, the solid form is unchanged.
                // --- surfaces ---
                page: "color-mix(in oklab, var(--mds-page) calc(<alpha-value> * 100%), transparent)",
                card: "color-mix(in oklab, var(--mds-card) calc(<alpha-value> * 100%), transparent)",
                "card-hover": "color-mix(in oklab, var(--mds-card-hover) calc(<alpha-value> * 100%), transparent)",
                field: "color-mix(in oklab, var(--mds-input) calc(<alpha-value> * 100%), transparent)",
                // Raw surface steps, for anything that needs more than page/card.
                "surface-0": "color-mix(in oklab, var(--bg-0) calc(<alpha-value> * 100%), transparent)",
                "surface-1": "color-mix(in oklab, var(--bg-1) calc(<alpha-value> * 100%), transparent)",
                "surface-2": "color-mix(in oklab, var(--bg-2) calc(<alpha-value> * 100%), transparent)",
                "surface-3": "color-mix(in oklab, var(--bg-3) calc(<alpha-value> * 100%), transparent)",
                "surface-4": "color-mix(in oklab, var(--bg-4) calc(<alpha-value> * 100%), transparent)",

                // --- lines ---
                line: "color-mix(in oklab, var(--mds-border) calc(<alpha-value> * 100%), transparent)",
                "line-hover": "color-mix(in oklab, var(--mds-border-hover) calc(<alpha-value> * 100%), transparent)",
                "line-strong": "color-mix(in oklab, var(--line-2) calc(<alpha-value> * 100%), transparent)",
                "line-field": "color-mix(in oklab, var(--mds-input-border) calc(<alpha-value> * 100%), transparent)",

                // --- brand / action ---
                brand: "color-mix(in oklab, var(--mds-action) calc(<alpha-value> * 100%), transparent)",
                "brand-hover": "color-mix(in oklab, var(--mds-action-hover) calc(<alpha-value> * 100%), transparent)",
                "brand-soft": "color-mix(in oklab, var(--mds-action-soft) calc(<alpha-value> * 100%), transparent)",
                "brand-ink": "color-mix(in oklab, var(--accent-ink) calc(<alpha-value> * 100%), transparent)",
                "brand-line": "color-mix(in oklab, var(--accent-line) calc(<alpha-value> * 100%), transparent)",

                // --- status ---
                success: "color-mix(in oklab, var(--mds-green) calc(<alpha-value> * 100%), transparent)",
                danger: "color-mix(in oklab, var(--mds-red) calc(<alpha-value> * 100%), transparent)",
                warning: "color-mix(in oklab, var(--mds-amber) calc(<alpha-value> * 100%), transparent)",
                "success-dim": "color-mix(in oklab, var(--win-dim) calc(<alpha-value> * 100%), transparent)",
                "danger-dim": "color-mix(in oklab, var(--loss-dim) calc(<alpha-value> * 100%), transparent)",
                "warning-dim": "color-mix(in oklab, var(--warn-dim) calc(<alpha-value> * 100%), transparent)",
                // LIVE is its own token, not "danger": a live match is not an error, and it is
                // the one thing on screen allowed to be the loudest.
                live: "color-mix(in oklab, var(--live) calc(<alpha-value> * 100%), transparent)",
                "live-ink": "color-mix(in oklab, var(--live-ink) calc(<alpha-value> * 100%), transparent)",

                // --- CS2 side coding ---
                "team-t": "color-mix(in oklab, var(--t) calc(<alpha-value> * 100%), transparent)",
                "team-t-dim": "color-mix(in oklab, var(--t-dim) calc(<alpha-value> * 100%), transparent)",
                "team-t-ghost": "color-mix(in oklab, var(--t-ghost) calc(<alpha-value> * 100%), transparent)",
                "team-ct": "color-mix(in oklab, var(--ct) calc(<alpha-value> * 100%), transparent)",
                "team-ct-dim": "color-mix(in oklab, var(--ct-dim) calc(<alpha-value> * 100%), transparent)",
                "team-ct-ghost": "color-mix(in oklab, var(--ct-ghost) calc(<alpha-value> * 100%), transparent)",

                // --- ink ---
                fg: "color-mix(in oklab, var(--mds-text-primary) calc(<alpha-value> * 100%), transparent)",
                "fg-soft": "color-mix(in oklab, var(--ink-1) calc(<alpha-value> * 100%), transparent)",
                "fg-muted": "color-mix(in oklab, var(--mds-text-muted) calc(<alpha-value> * 100%), transparent)",
                "fg-subtle": "color-mix(in oklab, var(--mds-text-subtle) calc(<alpha-value> * 100%), transparent)",
                "fg-faint": "color-mix(in oklab, var(--ink-4) calc(<alpha-value> * 100%), transparent)",

                // Theme-aware surface tints. `bg-tint` replaces `bg-white/5`, which is
                // invisible in light mode. Same idea for hover fills and faint washes.
                tint: "color-mix(in oklab, var(--tint-1) calc(<alpha-value> * 100%), transparent)",
                "tint-strong": "color-mix(in oklab, var(--tint-2) calc(<alpha-value> * 100%), transparent)",
                "tint-faint": "color-mix(in oklab, var(--tint-3) calc(<alpha-value> * 100%), transparent)",

                // --- overlays ---
                scrim: "color-mix(in oklab, var(--scrim) calc(<alpha-value> * 100%), transparent)",
                overlay: "color-mix(in oklab, var(--mds-overlay) calc(<alpha-value> * 100%), transparent)",
                ring: "color-mix(in oklab, var(--ring) calc(<alpha-value> * 100%), transparent)",
            },
            fontFamily: {
                // One job each (design.md §3): Inter for prose/UI/names, JetBrains Mono for
                // numerics (prefer `.mds-numeric`, which carries it), Martian Mono for the
                // wordmark and page titles.
                sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
                mono: ["var(--font-jet)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
                brand: ["var(--font-martian)", "var(--font-jet)", "ui-monospace", "monospace"],
            },
            fontSize: {
                // The type scale (globals.css). 11px is the floor — a LAN venue is dim and the
                // reader is standing up. `text-[10px]` / `text-[9px]` / `text-[8px]` are bugs.
                label: ["var(--fs-label)", { lineHeight: "1.45", letterSpacing: "0.1em" }],
                meta: ["var(--fs-meta)", { lineHeight: "1.5" }],
                body: ["var(--fs-body)", { lineHeight: "1.55" }],
                lead: ["var(--fs-lead)", { lineHeight: "1.55" }],
                title: ["var(--fs-title)", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
                head: ["var(--fs-head)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
                display: ["var(--fs-display)", { lineHeight: "0.98", letterSpacing: "-0.02em" }],
                score: ["var(--fs-score)", { lineHeight: "1", letterSpacing: "-0.03em" }],
            },
            borderRadius: {
                sm: "var(--mds-radius-small)",
                DEFAULT: "var(--mds-radius-medium)",
                md: "var(--mds-radius-medium)",
                lg: "var(--mds-radius-large)",
                xl: "var(--r-xl)",
                // Legacy aliases still referenced across components (kept to avoid churn).
                "mds-minimal": "2px",
                "mds-subtle": "3px",
                "mds-standard": "var(--mds-radius-small)",
                "mds-comfortable": "5px",
                "mds-card": "var(--mds-radius-medium)",
            },
            boxShadow: {
                sm: "var(--mds-shadow-sm)",
                DEFAULT: "var(--mds-shadow-md)",
                lg: "var(--mds-shadow-lg)",
                // Legacy aliases still referenced across components.
                "mds-whisper": "var(--mds-shadow-sm)",
                "mds-focus": "0 0 0 3px var(--mds-action-soft)",
            },
            ringColor: {
                DEFAULT: "var(--ring)",
            },
            maxWidth: {
                content: "var(--mds-max-content)",
                "mds-content": "var(--mds-max-content)",
            },
        },
    },
    plugins: [],
};
export default config;
