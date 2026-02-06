import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db-adapter'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/dashboard/stats - Estadisticas globales del dashboard
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    activeThreats,
    totalThreats,
    openIncidents,
    contractors,
    recentAuditLogs,
    mitigatedToday,
  ] = await Promise.all([
    prisma.threat.count({ where: { status: { notIn: ['mitigated', 'resolved', 'false_positive'] } } }),
    prisma.threat.count(),
    prisma.incident.count({ where: { status: { notIn: ['resolved', 'closed'] } } }),
    prisma.contractor.findMany({
      select: { id: true, name: true, healthScore: true, status: true, riskLevel: true },
      orderBy: { name: 'asc' },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
    prisma.threat.count({
      where: {
        status: 'mitigated',
        mitigatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ])

  // Calcular vendor health promedio
  const avgHealth = contractors.length > 0
    ? Math.round(contractors.reduce((acc, c) => acc + c.healthScore, 0) / contractors.length)
    : 0

  return NextResponse.json({
    activeThreats,
    totalThreats,
    openIncidents,
    vendorHealth: avgHealth,
    contractors,
    recentActivity: recentAuditLogs,
    mitigatedToday,
  })
}
