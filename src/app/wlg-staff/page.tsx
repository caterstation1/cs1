"use client"

import { StaffManager } from '@/components/staff/StaffManager'

export default function WlgStaffPage() {
  return (
    <StaffManager
      title="WLG Staff"
      filterByRoles={["wlg_team", "wlg_admin"]}
      allowedRoleOptions={["wlg_team", "wlg_admin"]}
    />
  )
}
