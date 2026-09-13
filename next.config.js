const createNextIntlPlugin = require('next-intl/plugin');

// Locale comes from a cookie, not the URL — see src/i18n/config.ts for why.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    images: {
        unoptimized: true,
        remotePatterns: [
            { hostname: 'upload.wikimedia.org' },
            { hostname: 'assets.xboxservices.com' },
            { hostname: 'logos-world.net' },
            { hostname: 'image.api.playstation.com' },
            { hostname: 'media.sketchfab.com' },
            { hostname: 'wallpapers.com' },
            { hostname: 'images.contentstack.io' },
            { hostname: 'avatars.steamstatic.com' },
            { hostname: 'steamcdn-a.akamaihd.net' },
            { hostname: 'i.imgur.com' },
            { hostname: 'api.dicebear.com' },
            { hostname: 'dynamic.fragbite.se' },
        ],
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },
};

/**
 * One canonical hostname. The tunnel still answers on the old apexplay host so existing links
 * and QR codes resolve, but everything lands on turnering.mortenlab.xyz — which matters beyond
 * tidiness: NEXTAUTH_URL is a single value, the Steam OpenID realm is derived from it, and the
 * session cookie is bound to that origin. Serving both hosts for real would mean a sign-in on
 * one silently not existing on the other.
 */
nextConfig.redirects = async () => [
    {
        source: '/:path*',
        has: [{ type: 'host', value: 'apexplay.mortenlab.xyz' }],
        destination: 'https://turnering.mortenlab.xyz/:path*',
        permanent: true,
    },
];

module.exports = withNextIntl(nextConfig);
