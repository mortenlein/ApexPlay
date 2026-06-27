import type { Config } from "tailwindcss";

/**
 * ApexPlay design tokens.
 *
 * The single source of truth for actual values is the CSS custom properties in
 * src/app/globals.css (so light/dark theming lives in one place). Tailwind here just
 * exposes them as semantic utilities — e.g. `bg-card`, `text-fg-muted`, `border-line`,
 * `bg-brand` — so components stop hand-writing `bg-[var(--mds-card)]`.
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
                page: "var(--mds-page)",
                card: "var(--mds-card)",
                "card-hover": "var(--mds-card-hover)",
                field: "var(--mds-input)",
                line: "var(--mds-border)",
                "line-hover": "var(--mds-border-hover)",

                brand: "var(--mds-action)",
                "brand-hover": "var(--mds-action-hover)",
                "brand-soft": "var(--mds-action-soft)",

                success: "var(--mds-green)",
                danger: "var(--mds-red)",
                warning: "var(--mds-amber)",

                fg: "var(--mds-text-primary)",
                "fg-muted": "var(--mds-text-muted)",
                "fg-subtle": "var(--mds-text-subtle)",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "system-ui", "sans-serif"],
                brand: ["var(--font-outfit)", "system-ui", "sans-serif"],
            },
            borderRadius: {
                sm: "var(--mds-radius-small)",
                DEFAULT: "var(--mds-radius-medium)",
                md: "var(--mds-radius-medium)",
                lg: "var(--mds-radius-large)",
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
            maxWidth: {
                content: "var(--mds-max-content)",
                "mds-content": "var(--mds-max-content)",
            },
        },
    },
    plugins: [],
};
export default config;
