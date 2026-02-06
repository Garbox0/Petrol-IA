/**
 * PETROL-IA: Network Discovery Service
 *
 * Descubre dispositivos reales en la red local mediante:
 * - ARP table (dispositivos en el segmento)
 * - Conexiones TCP activas (hosts con los que se comunica)
 * - Resolución DNS inversa de IPs encontradas
 *
 * Alimenta el radar táctico con nodos REALES.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import db from './db'

const execAsync = promisify(exec)

// ─── Tabla de dispositivos descubiertos ───────────────────────────────────────
export function ensureDiscoveryTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS DiscoveredDevice (
      ip TEXT PRIMARY KEY,
      mac TEXT,
      hostname TEXT,
      type TEXT DEFAULT 'unknown',
      vendor TEXT,
      openPorts TEXT,
      lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
      firstSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
      isOnline INTEGER DEFAULT 1,
      riskLevel TEXT DEFAULT 'low',
      networkSegment TEXT,
      lat REAL,
      lon REAL,
      country TEXT,
      city TEXT,
      distanceKm REAL
    )
  `)
  // Migrar tabla existente si le faltan columnas
  try { db.exec('ALTER TABLE DiscoveredDevice ADD COLUMN lat REAL') } catch {}
  try { db.exec('ALTER TABLE DiscoveredDevice ADD COLUMN lon REAL') } catch {}
  try { db.exec('ALTER TABLE DiscoveredDevice ADD COLUMN country TEXT') } catch {}
  try { db.exec('ALTER TABLE DiscoveredDevice ADD COLUMN city TEXT') } catch {}
  try { db.exec('ALTER TABLE DiscoveredDevice ADD COLUMN distanceKm REAL') } catch {}
}

export interface DiscoveredDevice {
  ip: string
  mac: string | null
  hostname: string | null
  type: string
  vendor: string | null
  openPorts: string | null
  lastSeen: string
  firstSeen: string
  isOnline: boolean
  riskLevel: string
  networkSegment: string | null
  lat: number | null
  lon: number | null
  country: string | null
  city: string | null
  distanceKm: number | null
}

// ─── Clasificación de dispositivo por MAC vendor ──────────────────────────────
const MAC_VENDORS: Record<string, { vendor: string; type: string }> = {
  '00:1a:2b': { vendor: 'Siemens', type: 'plc' },
  '00:0e:8c': { vendor: 'Siemens', type: 'plc' },
  '00:80:f4': { vendor: 'Schneider Electric', type: 'plc' },
  '00:00:54': { vendor: 'Schneider Electric', type: 'rtu' },
  '00:a0:45': { vendor: 'Phoenix Contact', type: 'switch_ot' },
  '00:01:05': { vendor: 'Beckhoff', type: 'plc' },
  '00:30:11': { vendor: 'ABB', type: 'rtu' },
  '00:c0:c7': { vendor: 'Yokogawa', type: 'dcs' },
  '00:06:0d': { vendor: 'Cisco', type: 'switch' },
  '00:1b:17': { vendor: 'Cisco', type: 'router' },
  '00:50:56': { vendor: 'VMware', type: 'server' },
  '00:0c:29': { vendor: 'VMware', type: 'server' },
  '08:00:27': { vendor: 'VirtualBox', type: 'server' },
  '00:15:5d': { vendor: 'Hyper-V', type: 'server' },
  'b8:27:eb': { vendor: 'Raspberry Pi', type: 'iot' },
  'dc:a6:32': { vendor: 'Raspberry Pi', type: 'iot' },
  'e4:5f:01': { vendor: 'Raspberry Pi', type: 'iot' },
}

function classifyByMac(mac: string): { vendor: string; type: string } | null {
  const prefix = mac.toLowerCase().substring(0, 8)
  return MAC_VENDORS[prefix] || null
}

// ─── Clasificación de segmento de red por IP ──────────────────────────────────
function classifySegment(ip: string): string {
  const parts = ip.split('.').map(Number)
  if (parts[0] === 10) {
    if (parts[1] === 0 && parts[2] === 0) return 'OT/SCADA'
    if (parts[1] === 0 && parts[2] === 1) return 'OT/Field'
    if (parts[1] === 0 && parts[2] === 2) return 'OT/Control'
    if (parts[1] === 0 && parts[2] === 3) return 'OT/RTU'
    if (parts[1] === 1) return 'Servidores'
    if (parts[1] === 2) return 'DMZ'
    return 'Corporativo'
  }
  if (parts[0] === 192 && parts[1] === 168) {
    if (parts[2] === 0) return 'LAN Principal'
    if (parts[2] === 1) return 'LAN Secundaria'
    if (parts[2] === 100) return 'Contratistas'
    return `VLAN ${parts[2]}`
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return 'Red Interna'
  return 'Externo'
}

// ─── GeoIP lookup + distancia Haversine ───────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4) return true
  if (p[0] === 10) return true
  if (p[0] === 127) return true
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
  if (p[0] === 192 && p[1] === 168) return true
  if (p[0] === 169 && p[1] === 254) return true
  return false
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface GeoResult { lat: number; lon: number; country: string; city: string }

// Caché en tabla IpReputation (reutilizar si ya existe lat/lon)
async function geolocateIp(ip: string): Promise<GeoResult | null> {
  if (isPrivateIp(ip)) return null

  // Buscar en caché
  try {
    const cached = db.prepare('SELECT lat, lon, country, city FROM IpReputation WHERE ip = ? AND lat IS NOT NULL').get(ip) as any
    if (cached) return { lat: cached.lat, lon: cached.lon, country: cached.country || '??', city: cached.city || '' }
  } catch {}

  // Usar ip-api.com (gratuito, 45 req/min, no requiere key)
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,country,city,countryCode,status`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'success') return null

    // Cachear en IpReputation
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS IpReputation (
        ip TEXT PRIMARY KEY, abuseScore INTEGER DEFAULT 0, country TEXT, isp TEXT,
        lastChecked DATETIME DEFAULT CURRENT_TIMESTAMP, isMalicious INTEGER DEFAULT 0,
        lat REAL, lon REAL, city TEXT
      )`)
      try { db.exec('ALTER TABLE IpReputation ADD COLUMN lat REAL') } catch {}
      try { db.exec('ALTER TABLE IpReputation ADD COLUMN lon REAL') } catch {}
      try { db.exec('ALTER TABLE IpReputation ADD COLUMN city TEXT') } catch {}
    } catch {}

    db.prepare(`
      INSERT OR REPLACE INTO IpReputation (ip, country, lat, lon, city, lastChecked)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(ip, data.countryCode || data.country, data.lat, data.lon, data.city)

    return { lat: data.lat, lon: data.lon, country: data.countryCode || data.country, city: data.city }
  } catch {
    return null
  }
}

// ─── Determinar riesgo basado en tipo y segmento ─────────────────────────────
function assessRisk(type: string, segment: string): string {
  if (type === 'plc' || type === 'rtu' || type === 'dcs') return 'critical'
  if (type === 'hmi' || type === 'switch_ot') return 'high'
  if (segment.startsWith('OT/')) return 'high'
  if (type === 'iot') return 'medium'
  if (segment === 'Contratistas') return 'medium'
  return 'low'
}

// ─── Descubrimiento via ARP Table ─────────────────────────────────────────────
async function discoverFromArp(): Promise<Array<{ ip: string; mac: string }>> {
  try {
    const { stdout } = await execAsync('arp -a', { timeout: 5000 })

    const devices: Array<{ ip: string; mac: string }> = []
    const lines = stdout.split('\n')

    for (const line of lines) {
      // Windows ARP format: "  192.168.1.1          aa-bb-cc-dd-ee-ff     dynamic"
      const match = line.match(/\s+([\d.]+)\s+([\da-f-]{17})\s+/i)
      if (match) {
        const ip = match[1]
        const mac = match[2].replace(/-/g, ':').toLowerCase()
        if (ip !== '255.255.255.255' && !ip.endsWith('.255')) {
          devices.push({ ip, mac })
        }
      }
    }

    return devices
  } catch (error) {
    console.error('[DISCOVERY] Error leyendo tabla ARP:', error)
    return []
  }
}

// ─── Descubrimiento via conexiones activas ────────────────────────────────────
async function discoverFromConnections(): Promise<Array<{ ip: string; ports: number[] }>> {
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "Get-NetTCPConnection -State Established | Select-Object RemoteAddress, RemotePort | ConvertTo-Json"',
      { timeout: 10000 }
    )

    let raw = JSON.parse(stdout)
    if (!Array.isArray(raw)) raw = raw ? [raw] : []

    // Agrupar por IP y colectar puertos
    const ipMap = new Map<string, Set<number>>()
    for (const conn of raw) {
      const ip = conn.RemoteAddress
      if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') continue
      if (!ipMap.has(ip)) ipMap.set(ip, new Set())
      ipMap.get(ip)!.add(conn.RemotePort)
    }

    return Array.from(ipMap.entries()).map(([ip, ports]) => ({
      ip,
      ports: Array.from(ports).sort((a, b) => a - b),
    }))
  } catch (error) {
    console.error('[DISCOVERY] Error capturando conexiones:', error)
    return []
  }
}

// ─── Resolución DNS inversa ───────────────────────────────────────────────────
async function resolveHostname(ip: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "[System.Net.Dns]::GetHostEntry('${ip}').HostName"`,
      { timeout: 3000 }
    )
    const hostname = stdout.trim()
    return hostname && hostname !== ip ? hostname : null
  } catch {
    return null
  }
}

// ─── Clasificar tipo de dispositivo por puertos abiertos ──────────────────────
function classifyByPorts(ports: number[]): string {
  if (ports.includes(502)) return 'plc'       // Modbus
  if (ports.includes(102)) return 'plc'       // S7
  if (ports.includes(44818)) return 'plc'     // EtherNet/IP
  if (ports.includes(20000)) return 'rtu'     // DNP3
  if (ports.includes(4840)) return 'hmi'      // OPC-UA
  if (ports.includes(47808)) return 'bms'     // BACnet
  if (ports.includes(1883) || ports.includes(8883)) return 'iot' // MQTT
  if (ports.includes(80) || ports.includes(443)) return 'server'
  if (ports.includes(3389)) return 'workstation' // RDP
  if (ports.includes(22)) return 'server'     // SSH
  return 'unknown'
}

// ─── CICLO PRINCIPAL DE DESCUBRIMIENTO ────────────────────────────────────────
export interface DiscoveryResult {
  timestamp: string
  devicesFound: number
  newDevices: number
  devices: DiscoveredDevice[]
  durationMs: number
}

export async function runDiscovery(userLat?: number, userLon?: number): Promise<DiscoveryResult> {
  const startTime = Date.now()
  ensureDiscoveryTable()

  const result: DiscoveryResult = {
    timestamp: new Date().toISOString(),
    devicesFound: 0,
    newDevices: 0,
    devices: [],
    durationMs: 0,
  }

  // 1. Descubrir desde ARP table
  const arpDevices = await discoverFromArp()

  // 2. Descubrir desde conexiones activas
  const connDevices = await discoverFromConnections()

  // 3. Merge ambas fuentes
  const deviceMap = new Map<string, { mac: string | null; ports: number[]; hostname: string | null }>()

  for (const dev of arpDevices) {
    deviceMap.set(dev.ip, { mac: dev.mac, ports: [], hostname: null })
  }

  for (const dev of connDevices) {
    if (deviceMap.has(dev.ip)) {
      deviceMap.get(dev.ip)!.ports = dev.ports
    } else {
      deviceMap.set(dev.ip, { mac: null, ports: dev.ports, hostname: null })
    }
  }

  // 4. Resolver hostnames para los primeros 20 dispositivos (evitar timeout)
  const ips = Array.from(deviceMap.keys()).slice(0, 20)
  const hostnamePromises = ips.map(async (ip) => {
    const hostname = await resolveHostname(ip)
    if (hostname && deviceMap.has(ip)) {
      deviceMap.get(ip)!.hostname = hostname
    }
  })
  await Promise.allSettled(hostnamePromises)

  // 5. GeoIP para IPs públicas (máximo 10 lookups por ciclo para no saturar)
  const geoCache = new Map<string, GeoResult | null>()
  const publicIps = Array.from(deviceMap.keys()).filter(ip => !isPrivateIp(ip)).slice(0, 10)
  const geoPromises = publicIps.map(async (ip) => {
    const geo = await geolocateIp(ip)
    geoCache.set(ip, geo)
  })
  await Promise.allSettled(geoPromises)

  // 6. Clasificar y persistir cada dispositivo
  // Marcar todos como offline primero, luego actualizar los encontrados
  db.prepare("UPDATE DiscoveredDevice SET isOnline = 0 WHERE lastSeen < datetime('now', '-5 minutes')").run()

  for (const [ip, data] of deviceMap) {
    // Clasificar
    const macInfo = data.mac ? classifyByMac(data.mac) : null
    const portType = data.ports.length > 0 ? classifyByPorts(data.ports) : null
    const type = macInfo?.type || portType || 'unknown'
    const vendor = macInfo?.vendor || null
    const segment = classifySegment(ip)
    const riskLevel = assessRisk(type, segment)

    // GeoIP data
    const geo = geoCache.get(ip) || null
    let distanceKm: number | null = null
    if (geo && userLat !== undefined && userLon !== undefined) {
      distanceKm = Math.round(haversineKm(userLat, userLon, geo.lat, geo.lon))
    }

    // Upsert en la DB
    const existing = db.prepare('SELECT * FROM DiscoveredDevice WHERE ip = ?').get(ip) as any

    if (existing) {
      db.prepare(`
        UPDATE DiscoveredDevice SET
          mac = COALESCE(?, mac),
          hostname = COALESCE(?, hostname),
          type = CASE WHEN ? != 'unknown' THEN ? ELSE type END,
          vendor = COALESCE(?, vendor),
          openPorts = ?,
          lastSeen = CURRENT_TIMESTAMP,
          isOnline = 1,
          riskLevel = ?,
          networkSegment = ?,
          lat = COALESCE(?, lat),
          lon = COALESCE(?, lon),
          country = COALESCE(?, country),
          city = COALESCE(?, city),
          distanceKm = COALESCE(?, distanceKm)
        WHERE ip = ?
      `).run(
        data.mac, data.hostname,
        type, type,
        vendor,
        data.ports.length > 0 ? JSON.stringify(data.ports) : existing.openPorts,
        riskLevel, segment,
        geo?.lat ?? null, geo?.lon ?? null,
        geo?.country ?? null, geo?.city ?? null,
        distanceKm,
        ip
      )
    } else {
      db.prepare(`
        INSERT INTO DiscoveredDevice (ip, mac, hostname, type, vendor, openPorts, lastSeen, firstSeen, isOnline, riskLevel, networkSegment, lat, lon, country, city, distanceKm)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, ?, ?, ?, ?, ?, ?, ?)
      `).run(ip, data.mac, data.hostname, type, vendor, JSON.stringify(data.ports), riskLevel, segment,
        geo?.lat ?? null, geo?.lon ?? null, geo?.country ?? null, geo?.city ?? null, distanceKm)
      result.newDevices++
    }
  }

  // 6. Leer todos los dispositivos de la DB
  const allDevices = db.prepare('SELECT * FROM DiscoveredDevice ORDER BY isOnline DESC, lastSeen DESC').all() as any[]
  result.devices = allDevices.map(d => ({
    ...d,
    isOnline: !!d.isOnline,
  }))
  result.devicesFound = allDevices.filter(d => d.isOnline).length
  result.durationMs = Date.now() - startTime

  return result
}

// ─── Obtener dispositivos para el radar ───────────────────────────────────────
export function getRadarDevices(): DiscoveredDevice[] {
  ensureDiscoveryTable()
  const devices = db.prepare("SELECT * FROM DiscoveredDevice WHERE lastSeen > datetime('now', '-30 minutes') ORDER BY riskLevel DESC, lastSeen DESC LIMIT 50").all() as any[]
  return devices.map(d => ({ ...d, isOnline: !!d.isOnline }))
}
