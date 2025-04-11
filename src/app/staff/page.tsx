"use client"

import { useEffect, useState } from 'react'
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

interface Staff {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  payRate: number
  accessLevel: 'basic' | 'admin' | 'owner'
  isDriver: boolean
  password?: string
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const { toast } = useToast()

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff')
      if (!response.ok) throw new Error('Failed to fetch staff')
      const data = await response.json()
      setStaff(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch staff members",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return

    try {
      const response = await fetch(`/api/staff/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete staff member')

      await fetchStaff()
      toast({
        title: "Success",
        description: "Staff member deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete staff member",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (staff: Staff) => {
    setSelectedStaff(staff)
    setIsEditDialogOpen(true)
  }

  const handleSendInvitation = async (id: string) => {
    try {
      const response = await fetch(`/api/staff/${id}/invite`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send invitation')
      }

      toast({
        title: "Success",
        description: "Login invitation sent successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      })
    }
  }

  // Fetch staff on component mount
  useEffect(() => {
    fetchStaff()
  }, [])

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>Add Staff Member</Button>
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
              <TableCell>${member.payRate.toFixed(2)}</TableCell>
              <TableCell>{member.isDriver ? 'Yes' : 'No'}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(member)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendInvitation(member.id)}
                  >
                    Send Login
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(member.id)}
                  >
                    Delete
                  </Button>
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
      />

      {selectedStaff && (
        <EditStaffDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          staff={selectedStaff}
          onSuccess={fetchStaff}
        />
      )}
    </div>
  )
} 