/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    images: {
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
            { hostname: 'api.dicebear.com' },
        ],
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },
};

module.exports = nextConfig;
