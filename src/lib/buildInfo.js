// ビルド時に vite.config.js の define で注入される定数
// eslint-disable-next-line no-undef
export const BUILD_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
// eslint-disable-next-line no-undef
export const BUILD_SHA = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'local'
// eslint-disable-next-line no-undef
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()

export function buildLabel() {
  const ts = new Date(BUILD_TIME).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  return `v${BUILD_VERSION} · ${BUILD_SHA} · ${ts}`
}
