import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event) {
    const tenantSlug = event.request?.headers?.['x-tenant-slug']
    if (tenantSlug) {
      event.tags = { ...event.tags, tenant: tenantSlug }
    }
    return event
  },
})
