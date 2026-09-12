import type { Config } from "tailwindcss";

/**
 * ApexPlay design tokens.
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
                // --- surfaces ---
                page: "var(--mds-page)",
                card: "var(--mds-card)",
                "card-hover": "var(--mds-card-hover)",
                field: "var(--mds-input)",
                // Raw surface steps, for anything that needs more than page/card.
                "surface-0": "var(--bg-0)",
                "surface-1": "var(--bg-1)",
                "surface-2": "var(--bg-2)",
                "surface-3": "var(--bg-3)",
                "surface-4": "var(--bg-4)",

                // --- lines ---
                line: "var(--mds-border)",
                "line-hover": "var(--mds-border-hover)",
                "line-strong": "var(--line-2)",
                "line-field": "var(--mds-input-border)",

                // --- brand / action ---
                brand: "var(--mds-action)",
                "brand-hover": "var(--mds-action-hover)",
                "brand-soft": "var(--mds-action-soft)",
                "brand-ink": "var(--accent-ink)",
                "brand-line": "var(--accent-line)",

                // --- status ---
                success: "var(--mds-green)",
                danger: "var(--mds-red)",
                warning: "var(--mds-amber)",
                "success-dim": "var(--win-dim)",
                "danger-dim": "var(--loss-dim)",
                "warning-dim": "var(--warn-dim)",
                // LIVE is its own token, not "danger": a live match is not an error, and it is
                // the one thing on screen allowed to be the loudest.
                live: "var(--live)",
                "live-ink": "var(--live-ink)",

                // --- CS2 side coding ---
                "team-t": "var(--t)",
                "team-t-dim": "var(--t-dim)",
                "team-t-ghost": "var(--t-ghost)",
                "team-ct": "var(--ct)",
                "team-ct-dim": "var(--ct-dim)",
                "team-ct-ghost": "var(--ct-ghost)",

                // --- ink ---
                fg: "var(--mds-text-primary)",
                "fg-soft": "var(--ink-1)",
                "fg-muted": "var(--mds-text-muted)",
                "fg-subtle": "var(--mds-text-subtle)",
                "fg-faint": "var(--ink-4)",

                // Theme-aware surface tints. `bg-tint` replaces `bg-white/5`, which is
                // invisible in light mode. Same idea for hover fills and faint washes.
                tint: "var(--tint-1)",
                "tint-strong": "var(--tint-2)",
                "tint-faint": "var(--tint-3)",

                // --- overlays ---
                scrim: "var(--scrim)",
                overlay: "var(--mds-overlay)",
                ring: "var(--ring)",
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
