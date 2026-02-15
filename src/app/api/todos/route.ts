import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const completed = searchParams.get('completed')
    const where =
      completed === null
        ? undefined
        : { isCompleted: completed === '1' || completed === 'true' }

    const todos = await prisma.dashboardTodo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(todos)
  } catch (e) {
    console.error('GET /api/todos failed', e)
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const todo = await prisma.dashboardTodo.create({
      data: {
        userId: data.userId || 'unknown',
        content: data.content,
      },
    })
    return NextResponse.json(todo, { status: 201 })
  } catch (e) {
    console.error('POST /api/todos failed', e)
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 })
  }
}



