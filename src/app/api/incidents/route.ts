import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db-adapter'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/incidents
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: any = {}
  if (status) where.status = status

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      threat: { select: { id: true, type: true, severity: true, sourceIp: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(incidents)
}

// POST /api/incidents - Crear incidente (puede estar vinculado a una amenaza)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, description, severity, threatId, assignedToId } = body

  if (!title || !description || !severity) {
    return NextResponse.json({ error: 'Missing required fields: title, description, severity' }, { status: 400 })
  }

  const incident = await prisma.incident.create({
    data: {
      title,
      description,
      severity,
      threatId,
      assignedToId,
    },
  })

  await prisma.auditLog.create({
    data: {
      action: 'incident.created',
      entityType: 'incident',
      entityId: incident.id,
      userId: (session.user as any).id,
      incidentId: incident.id,
      details: JSON.stringify({ title, severity, threatId }),
    },
  })

  return NextResponse.json(incident, { status: 201 })
}
