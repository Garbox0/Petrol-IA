import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db-adapter'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/contractors
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contractors = await prisma.contractor.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          users: true,
          threats: true,
          accessRequests: true,
        },
      },
    },
  })

  return NextResponse.json(contractors)
}

// PATCH /api/contractors - Actualizar health score
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, healthScore, status, riskLevel } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const data: any = {}
  if (healthScore !== undefined) data.healthScore = healthScore
  if (status) data.status = status
  if (riskLevel) data.riskLevel = riskLevel

  const contractor = await prisma.contractor.update({
    where: { id },
    data,
  })

  return NextResponse.json(contractor)
}
