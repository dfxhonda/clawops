import { Sentry } from './sentry'

const isDev = import.meta.env.DEV

function scrubPayload(payload) {
  if (typeof payload !== 'object' || !payload) return payload
  try {
    const s = JSON.stringify(payload)
      .replace(/"[^"]*@[^"]+\.[^"]+"/g, '"[email]"')
      .replace(/\b0[789]\d{8,9}\b/g, '[phone]')
    return JSON.parse(s)
  } catch { return payload }
}

export const logger = {
  debug(event, payload) {
    if (isDev) console.debug(`[${event}]`, payload)
  },
  info(event, payload) {
    if (isDev) console.info(`[${event}]`, payload)
  },
  warn(event, payload) {
    console.warn(`[${event}]`, payload)
  },
  error(event, payload) {
    console.error(`[${event}]`, payload)
    try {
      Sentry.captureException(
        payload instanceof Error ? payload : new Error(event),
        { extra: { event, ...scrubPayload(payload) } }
      )
    } catch {}
  },
  fatal(event, payload) {
    console.error(`[FATAL:${event}]`, payload)
    try {
      Sentry.captureException(
        payload instanceof Error ? payload : new Error(event),
        { level: 'fatal', extra: { event, ...scrubPayload(payload) } }
      )
    } catch {}
  },
}
