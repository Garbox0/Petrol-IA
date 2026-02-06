import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db-adapter'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/incidents/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      threat: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  })

  if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(incident)
}

// PATCH /api/incidents/[id] - Transicionar estado del incidente
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { status, assignedToId } = body

  const data: any = {}
  if (status) data.status = status
  if (assignedToId) data.assignedToId = assignedToId

  // Timestamps automaticos segun transicion
  if (status === 'contained') data.containedAt = new Date()
  if (status === 'resolved') data.resolvedAt = new Date()
  if (status === 'closed') data.closedAt = new Date()

  const incident = await prisma.incident.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, name: true } },
      threat: { select: { id: true, type: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      action: `incident.${status || 'updated'}`,
      entityType: 'incident',
      entityId: id,
      userId: (session.user as any).id,
      incidentId: id,
      details: JSON.stringify(body),
    },
  })

  return NextResponse.json(incident)
}
