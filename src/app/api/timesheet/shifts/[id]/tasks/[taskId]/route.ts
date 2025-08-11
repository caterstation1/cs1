import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: shiftId, taskId } = await params
    const body = await request.json()
    
    console.log(`📝 Updating task completion: ${taskId} for shift: ${shiftId}`)
    
    const updatedTask = await prisma.shiftTask.update({
      where: { id: taskId },
      data: {
        isCompleted: body.isCompleted,
        completedAt: body.completedAt ? new Date(body.completedAt) : null
      },
      include: {
        shift: true
      }
    })
    
    console.log(`✅ Updated task: ${taskId}`)
    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error('❌ Error updating task:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

