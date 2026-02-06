/**
 * API de Detección Automática de Amenazas
 *
 * POST /api/detection/scan - Ejecuta un ciclo de detección completo
 *   Body opcional: { lat: number, lon: number } para cálculo de distancias
 * GET  /api/detection/scan - Obtiene estado del último escaneo + dispositivos descubiertos
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runDetectionCycle } from '@/lib/detection-engine'
import { runDiscovery, getRadarDevices } from '@/lib/network-discovery'

export const runtime = 'nodejs'

// Cache del último resultado para no re-escanear constantemente
let lastDetectionResult: any = null
let lastDiscoveryResult: any = null
let isRunning = false

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (isRunning) {
    return NextResponse.json({
      status: 'already_running',
      message: 'Ya hay un ciclo de detección en curso',
      lastResult: lastDetectionResult,
    })
  }

  isRunning = true

  try {
    // Leer coordenadas del usuario si las envía
    let userLat: number | undefined
    let userLon: number | undefined
    try {
      const body = await request.json()
      if (body.lat && body.lon) {
        userLat = body.lat
        userLon = body.lon
      }
    } catch {
      // Sin body = sin coordenadas, OK
    }

    // Ejecutar detección y descubrimiento en paralelo
    const [detection, discovery] = await Promise.all([
      runDetectionCycle(),
      runDiscovery(userLat, userLon),
    ])

    lastDetectionResult = detection
    lastDiscoveryResult = discovery

    // Calcular rango máximo detectado
    const maxDistance = discovery.devices.reduce((max: number, d: any) => {
      return d.distanceKm && d.distanceKm > max ? d.distanceKm : max
    }, 0)

    return NextResponse.json({
      status: 'completed',
      detection,
      discovery: {
        devicesFound: discovery.devicesFound,
        newDevices: discovery.newDevices,
        durationMs: discovery.durationMs,
        maxDistanceKm: maxDistance,
      },
    })
  } catch (error) {
    console.error('[API/DETECTION] Error en ciclo de detección:', error)
    return NextResponse.json({ error: 'Detection cycle failed', details: String(error) }, { status: 500 })
  } finally {
    isRunning = false
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Devolver dispositivos para el radar + último resultado de detección
  const radarDevices = getRadarDevices()

  // Calcular rango máximo
  const maxDistance = radarDevices.reduce((max: number, d: any) => {
    return d.distanceKm && d.distanceKm > max ? d.distanceKm : max
  }, 0)

  return NextResponse.json({
    lastDetection: lastDetectionResult,
    lastDiscovery: lastDiscoveryResult,
    radarDevices,
    maxDistanceKm: maxDistance,
    isRunning,
  })
}
