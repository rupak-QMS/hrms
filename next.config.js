/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  serverExternalPackages: [],
  images: {
    remotePatterns: [
      {
        // Vercel Blob CDN — document/file uploads via @vercel/blob
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  // Security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options',           value: 'DENY' },
        { key: 'X-Content-Type-Options',    value: 'nosniff' },
        { key: 'X-DNS-Prefetch-Control',    value: 'on' },
        { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          // Allows Next.js inline scripts + Vercel analytics; tighten 'unsafe-eval' once deps allow
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.sentry.io",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://avatars.githubusercontent.com",
            "connect-src 'self' https://api.resend.com https://*.neon.tech https://vercel.live wss://ws-us3.pusher.com https://*.sentry.io",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
          ].join('; '),
        },
      ],
    },
  ],
}
// Root '/' is handled by src/app/page.tsx which redirects based on x-tenant-slug header.

module.exports = withSentryConfig(nextConfig, {
  // Sentry organisation and project are set via SENTRY_ORG / SENTRY_PROJECT env vars
  // Source maps are uploaded to Sentry on every build (disabled in CI to keep build fast)
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
})
