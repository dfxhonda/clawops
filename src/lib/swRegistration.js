// SPEC-PWA-LOGIN-SW-UPDATE-01 / SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01
// main.jsxからの循環依存を避けてLogin.jsx等が参照できるよう分離
import { registerSW } from 'virtual:pwa-register'
export const updateSW = registerSW({ immediate: true })
