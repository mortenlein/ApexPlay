import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // HASHICORP METADATA DESIGN SYSTEM (MDS)
                'mds-dark-charcoal': '#15181e',
                'mds-near-black': '#0d0e12',
                'mds-near-white': '#efeff1',
                'mds-charcoal': '#3b3d45',
                'mds-cool-gray': '#b2b6bd',
                'mds-mid-gray': '#d5d7db',
                'mds-light-gray': '#f1f2f3',
                'mds-dark-gray': '#656a76',
                
                // ACTION & LINKS
                'mds-action-blue': '#1060ff',
                'mds-link-blue': '#2264d6',
                'mds-bright-blue': '#2b89ff',
                
                // PRODUCT ACCENTS
                'mds-terraform': '#7b42bc',
                'mds-vault': '#ffcf25',
                'mds-waypoint': '#14c6cb',
                'mds-vagrant': '#1868f2',
                'mds-waypoint-hover': '#12b6bb',
                
                // SEMANTIC
                'mds-amber': '#bb5a00',
                'mds-red': '#731e25',
                'mds-navy': '#101a59',
            },
            fontFamily: {
                sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
                brand: ['var(--font-outfit)', 'sans-serif'],
            },
            lineHeight: {
                'tight-headings': '1.18',
                'relaxed-body': '1.63',
                'relaxed-nav': '1.60',
            },
            letterSpacing: {
                'mds-caption': '1.3px',
            },
            borderRadius: {
                'mds-minimal': '2px',
                'mds-subtle': '3px',
                'mds-standard': '4px',
                'mds-comfortable': '5px',
                'mds-card': '8px',
            },
            boxShadow: {
                'mds-whisper': 'rgba(97, 104, 117, 0.05) 0px 1px 1px, rgba(97, 104, 117, 0.05) 0px 2px 2px',
                'mds-focus': '0 0 0 3px var(--mds-color-focus-action-external)',
            },
            maxWidth: {
                'mds-content': '1150px',
            },
            spacing: {
                // Systematic Spacing
                '8px': '8px',
                '16px': '16px',
                '24px': '24px',
                '32px': '32px',
                '40px': '40px',
                '48px': '48px',
                '80px': '80px',
            }
        },
    },
    plugins: [],
};
export default config;
