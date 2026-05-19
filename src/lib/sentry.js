import * as Sentry from '@sentry/react'

function scrubEvent(event) {
  try {
    const str = JSON.stringify(event)
    const cleaned = str
      .replace(/(token%3D|token=)[^"&\s]+/g, '$1[REDACTED]')
      .replace(/"[^"]{3,}@[^"]+\.[^"]{2,}"/g, '"[email]"')
      .replace(/\b0[789]\d{8,9}\b/g, '[phone]')
    return JSON.parse(cleaned)
  } catch {
    return event
  }
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!import.meta.env.PROD || !dsn) {
    console.info('[sentry] skipped (not prod or no DSN)')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_VERCEL_ENV || 'production',
    release:     import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA,
    enabled:     true,
    tracesSampleRate:         1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend(event) {
      return scrubEvent(event)
    },
  })

  console.info('[sentry] initialized, release=' + (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ?? 'unknown'))
}

export function setSentryContext({ organizationId, storeCode, page, sessionId } = {}) {
  Sentry.setTags({
    organization_id: organizationId ?? 'unknown',
    store_code:      storeCode      ?? 'unknown',
    page:            page           ?? 'unknown',
    session_id:      sessionId      ?? 'unknown',
  })
}

export { Sentry }
