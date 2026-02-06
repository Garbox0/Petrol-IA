import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db-adapter'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/threats/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const threat = await prisma.threat.findUnique({
    where: { id },
    include: {
      mitigatedBy: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
      incidents: true,
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!threat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(threat)
}

// PATCH /api/threats/[id] - Actualizar estado (mitigar, bloquear, etc.)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { status, riskAnalysis } = body

  const data: any = { status }
  if (riskAnalysis) data.riskAnalysis = riskAnalysis

  if (status === 'mitigated' || status === 'resolved') {
    data.mitigatedAt = new Date()
    data.mitigatedById = (session.user as any).id
  }

  const threat = await prisma.threat.update({
    where: { id },
    data,
    include: {
      mitigatedBy: { select: { id: true, name: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      action: `threat.${status}`,
      entityType: 'threat',
      entityId: id,
      userId: (session.user as any).id,
      details: JSON.stringify({ previousStatus: body.previousStatus, newStatus: status }),
    },
  })

  return NextResponse.json(threat)
}
