"use client"

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AddStaffDialog } from '@/components/staff/AddStaffDialog'
import { EditStaffDialog } from '@/components/staff/EditStaffDialog'
import { useToast } from '@/components/ui/use-toast'

export interface StaffRecord {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  payRate: number
  accessLevel: string
  isDriver: boolean
}

interface Permissions {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canInvite: boolean
  canChangeRole: boolean
}

interface StaffManagerProps {
  title: string
  filterByRoles?: string[]
  allowedRoleOptions?: string[]
  permissions?: Partial<Permissions>
}

export function StaffManager({ title, filterByRoles, allowedRoleOptions, permissions }: StaffManagerProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null)

  // Support both direct and nested session shapes
  const sessionUser = (session as any)?.session?.user || (session as any)?.user || null
  const role = (sessionUser && (sessionUser as any).accessLevel) || ''

  const derivedPermissions: Permissions = useMemo(() => {
    // Defaults: owner/admin full control; others read-only
    let base: Permissions = {
      canCreate: role === 'owner' || role === 'admin',
      canEdit: role === 'owner' || role === 'admin',
      canDelete: role === 'owner' || role === 'admin',
      canInvite: !!role,
      canChangeRole: role === 'owner' || role === 'admin'
    }
    // WLG scope
    if (filterByRoles && (role === 'wlg_admin' || role === 'wlg_team')) {
      base = {
        canCreate: role === 'wlg_admin',
        canEdit: role === 'wlg_admin',
        canDelete: role === 'wlg_admin',
        canInvite: true,
        canChangeRole: role === 'wlg_admin'
      }
    }
    return { ...base, ...permissions }
  }, [role, filterByRoles, permissions])

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff')
      if (!response.ok) throw new Error('Failed to fetch staff')
      const data = await response.json()
      let list = data as StaffRecord[]
      if (filterByRoles && filterByRoles.length > 0) {
        list = list.filter(s => filterByRoles.includes(s.accessLevel))
      }
      setStaff(list)
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch staff members', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!derivedPermissions.canDelete) return
    if (!confirm('Are you sure you want to delete this staff member?')) return
    try {
      const response = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({} as any))
        throw new Error(data.error || 'Failed to delete staff member')
      }
      await fetchStaff()
      toast({ title: 'Success', description: 'Staff member deleted successfully' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete staff member', variant: 'destructive' })
    }
  }

  const handleEdit = (member: StaffRecord) => {
    if (!derivedPermissions.canEdit) return
    setSelectedStaff(member)
    setIsEditDialogOpen(true)
  }

  const handleSendInvitation = async (id: string) => {
    if (!derivedPermissions.canInvite) return
    try {
      const response = await fetch(`/api/staff/${id}/invite`, { method: 'POST' })
      const data = await response.json().catch(() => ({} as any))
      if (!response.ok) throw new Error(data.error || 'Failed to send invitation')
      toast({ title: 'Success', description: 'Login invitation sent successfully' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to send invitation', variant: 'destructive' })
    }
  }

  useEffect(() => { fetchStaff() }, [])

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {derivedPermissions.canCreate && (
          <Button onClick={() => setIsAddDialogOpen(true)}>Add Staff Member</Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Pay Rate</TableHead>
            <TableHead>Driver Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => (
            <TableRow key={member.id}>
              <TableCell>{`${member.firstName} ${member.lastName}`}</TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell>{member.phone}</TableCell>
              <TableCell>{member.accessLevel}</TableCell>
              <TableCell>${member.payRate ? member.payRate.toFixed(2) : '0.00'}</TableCell>
              <TableCell>{member.isDriver ? 'Yes' : 'No'}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {derivedPermissions.canEdit && (
                    <Button variant="outline" size="sm" onClick={() => handleEdit(member)}>Edit</Button>
                  )}
                  {derivedPermissions.canInvite && (
                    <Button variant="outline" size="sm" onClick={() => handleSendInvitation(member.id)}>Send Login</Button>
                  )}
                  {derivedPermissions.canDelete && (
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(member.id)}>Delete</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AddStaffDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchStaff}
        allowedRoleOptions={allowedRoleOptions}
      />

      {selectedStaff && (
        <EditStaffDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          staff={selectedStaff as any}
          onSuccess={fetchStaff}
          allowedRoleOptions={allowedRoleOptions}
        />
      )}
    </div>
  )
}
