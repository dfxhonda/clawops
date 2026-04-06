// ビルド時に vite.config.js の define で注入される定数
/* eslint-disable no-undef */
export const BUILD_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
export const BUILD_SHA = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'local'
export const BUILD_NUMBER = typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : '0'
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()
/* eslint-enable no-undef */

export function buildLabel() {
  const ts = new Date(BUILD_TIME).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  return `build #${BUILD_NUMBER} · ${BUILD_SHA} · ${ts}`
}
