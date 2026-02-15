import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const data = await req.json()
    const todo = await prisma.dashboardTodo.update({
      where: { id },
      data: {
        content: data.content ?? undefined,
        isCompleted: typeof data.isCompleted === 'boolean' ? data.isCompleted : undefined,
      },
    })
    return NextResponse.json(todo)
  } catch (e) {
    console.error('PATCH /api/todos/[id] failed', e)
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await prisma.dashboardTodo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/todos/[id] failed', e)
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 })
  }
}


