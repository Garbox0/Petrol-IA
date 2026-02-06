import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db-adapter'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/threats - Listar amenazas
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: any = {}
  if (status) where.status = status
  if (severity) where.severity = severity

  const threats = await prisma.threat.findMany({
    where,
    orderBy: { detectedAt: 'desc' },
    take: limit,
    include: {
      mitigatedBy: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(threats)
}

// POST /api/threats - Crear nueva amenaza
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, description, severity, sourceIp, targetAsset, protocol, riskAnalysis, raw, contractorId } = body

  if (!type || !description || !severity || !sourceIp || !targetAsset) {
    return NextResponse.json({ error: 'Missing required fields: type, description, severity, sourceIp, targetAsset' }, { status: 400 })
  }

  const threat = await prisma.threat.create({
    data: {
      type,
      description,
      severity,
      sourceIp,
      targetAsset,
      protocol,
      riskAnalysis,
      raw,
      contractorId,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'threat.created',
      entityType: 'threat',
      entityId: threat.id,
      userId: (session.user as any).id,
      details: JSON.stringify({ type, severity, sourceIp }),
    },
  })

  return NextResponse.json(threat, { status: 201 })
}
