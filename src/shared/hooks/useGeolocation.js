import { useCallback } from 'react'

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 300000,
  timeout: 3000,
}

const LOCATION_AUDIT_ENABLED = import.meta.env.VITE_FF_LOCATION_AUDIT !== 'false'

const NULL_LOC = { lat: null, lng: null, accuracy: null }

export function useGeolocation() {
  const getLocation = useCallback(async () => {
    if (!LOCATION_AUDIT_ENABLED) return NULL_LOC
    if (!navigator.geolocation) return NULL_LOC
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS)
      })
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
    } catch {
      return NULL_LOC
    }
  }, [])
  return { getLocation }
}
