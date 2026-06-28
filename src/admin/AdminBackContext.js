// DIAG-ADMIN-METER-EDIT-NUMPAD-3FIX-01 F2: AdminBreadcrumb の戻るを画面側からoverrideするための ref context。
// useRef を渡すことで Context 更新による余計な再レンダーを防ぐ。
import { createContext, useContext } from 'react'

export const AdminBackContext = createContext(null)
export function useAdminBack() { return useContext(AdminBackContext) }
