// SPEC-PWA-SW-STRIP-PHASE1-01: savepoint。カスタムSW更新層全廃。phase2でautoUpdate化予定。
import { registerSW } from 'virtual:pwa-register'

export const updateSW = registerSW({ immediate: true })
