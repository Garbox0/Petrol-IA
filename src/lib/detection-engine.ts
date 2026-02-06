/**
 * PETROL-IA: Motor de Detección de Amenazas en Tiempo Real
 *
 * Analiza conexiones TCP activas del sistema, detecta anomalías,
 * cruza contra threat intelligence y genera amenazas reales en la DB.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import db from './db'
import { v4 as uuidv4 } from 'uuid'

const execAsync = promisify(exec)

// ─── Puertos sospechosos conocidos ────────────────────────────────────────────
const SUSPICIOUS_PORTS: Record<number, { type: string; severity: string; description: string }> = {
  // C2 / RAT
  4444: { type: 'C2 Backdoor (Metasploit)', severity: 'critical', description: 'Puerto 4444 asociado a Metasploit/Meterpreter reverse shell' },
  5555: { type: 'C2 Backdoor', severity: 'critical', description: 'Puerto 5555 usado por múltiples RATs (Android Debug Bridge explotado, DCRat)' },
  1234: { type: 'C2 Backdoor', severity: 'high', description: 'Puerto 1234 asociado a troyanos de acceso remoto' },
  31337: { type: 'C2 Elite Backdoor', severity: 'critical', description: 'Puerto 31337 (eleet) - backdoor clásico, altamente sospechoso' },
  6667: { type: 'IRC C2 Channel', severity: 'high', description: 'Puerto IRC usado frecuentemente como canal de comando y control de botnets' },
  6697: { type: 'IRC-SSL C2 Channel', severity: 'high', description: 'IRC sobre SSL usado como C2 cifrado' },
  8080: { type: 'Proxy/C2 HTTP Alternativo', severity: 'medium', description: 'Puerto HTTP alternativo - puede ser proxy malicioso o C2 HTTP' },
  9090: { type: 'WebSocket C2', severity: 'medium', description: 'Puerto 9090 usado por varios frameworks C2 modernos' },
  // Crypto mining
  3333: { type: 'Crypto Mining (Stratum)', severity: 'high', description: 'Puerto Stratum - protocolo de minería de criptomonedas' },
  14433: { type: 'Crypto Mining (Stratum-SSL)', severity: 'high', description: 'Puerto Stratum sobre TLS - minería cifrada' },
  14444: { type: 'Crypto Mining', severity: 'high', description: 'Puerto alternativo de pool de minería' },
  45700: { type: 'Crypto Mining (XMR)', severity: 'high', description: 'Puerto asociado a minería de Monero' },
  // Exfiltración
  53: { type: 'DNS Tunneling Potencial', severity: 'medium', description: 'Conexión TCP al puerto 53 (DNS sobre TCP puede indicar tunneling o exfiltración)' },
  // OT/ICS - Si se ven desde fuera del segmento OT
  502: { type: 'Modbus Exposed', severity: 'critical', description: 'Protocolo Modbus/TCP detectado - protocolo industrial sin autenticación nativa' },
  102: { type: 'S7comm Exposed', severity: 'critical', description: 'Protocolo Siemens S7 detectado - comunicación directa con PLCs' },
  44818: { type: 'EtherNet/IP Exposed', severity: 'critical', description: 'Protocolo EtherNet/IP industrial detectado' },
  20000: { type: 'DNP3 Exposed', severity: 'critical', description: 'Protocolo DNP3 detectado - usado en SCADA de utilities' },
  4840: { type: 'OPC-UA Exposed', severity: 'high', description: 'Puerto OPC-UA detectado - interfaz de automatización industrial' },
  47808: { type: 'BACnet Exposed', severity: 'high', description: 'Protocolo BACnet detectado - automatización de edificios' },
  2404: { type: 'IEC 60870-5-104', severity: 'critical', description: 'Protocolo IEC 104 detectado - telecontrol de subestaciones eléctricas' },
  1883: { type: 'MQTT Unencrypted', severity: 'medium', description: 'MQTT sin cifrar detectado - usado en IoT/IIoT industrial' },
  8883: { type: 'MQTT-SSL', severity: 'low', description: 'MQTT cifrado - verificar si es tráfico autorizado' },
}

// ─── Puertos legítimos que NO deben generar alerta ────────────────────────────
const SAFE_PORTS = new Set([80, 443, 22, 3389, 445, 135, 139, 993, 587, 465, 25, 110, 143, 389, 636, 3306, 5432, 27017, 6379, 11211])

// ─── Rangos de IP privados ────────────────────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0' || ip.startsWith('::ffff:127.')) return true
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return true // IPv6 o formato raro, tratamos como privado
  if (parts[0] === 10) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 169 && parts[1] === 254) return true // link-local
  return false
}

// ─── Caché de reputación de IPs ───────────────────────────────────────────────
interface IpReputation {
  ip: string
  abuseScore: number
  country: string
  isp: string
  lastChecked: string
  isMalicious: boolean
}

function ensureReputationTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS IpReputation (
      ip TEXT PRIMARY KEY,
      abuseScore INTEGER DEFAULT 0,
      country TEXT DEFAULT 'unknown',
      isp TEXT DEFAULT 'unknown',
      lastChecked DATETIME DEFAULT CURRENT_TIMESTAMP,
      isMalicious INTEGER DEFAULT 0
    )
  `)
}

function getCachedReputation(ip: string): IpReputation | null {
  const row = db.prepare('SELECT * FROM IpReputation WHERE ip = ? AND lastChecked > datetime("now", "-1 hour")').get(ip) as any
  if (!row) return null
  return { ...row, isMalicious: !!row.isMalicious }
}

function cacheReputation(rep: IpReputation) {
  db.prepare(`
    INSERT OR REPLACE INTO IpReputation (ip, abuseScore, country, isp, lastChecked, isMalicious)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(rep.ip, rep.abuseScore, rep.country, rep.isp, new Date().toISOString(), rep.isMalicious ? 1 : 0)
}

// ─── Consulta AbuseIPDB ──────────────────────────────────────────────────────
async function checkAbuseIPDB(ip: string): Promise<IpReputation | null> {
  const apiKey = process.env.ABUSE_IPDB_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`, {
      headers: { 'Key': apiKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null

    const data = await res.json()
    const d = data.data
    return {
      ip,
      abuseScore: d.abuseConfidenceScore || 0,
      country: d.countryCode || 'unknown',
      isp: d.isp || 'unknown',
      lastChecked: new Date().toISOString(),
      isMalicious: (d.abuseConfidenceScore || 0) >= 50,
    }
  } catch {
    return null
  }
}

// ─── Captura de conexiones TCP reales ─────────────────────────────────────────
interface TcpConnection {
  remoteIp: string
  remotePort: number
  localPort: number
  state: string
  pid?: number
  processName?: string
}

async function captureTcpConnections(): Promise<TcpConnection[]> {
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "Get-NetTCPConnection -State Established | Select-Object RemoteAddress, RemotePort, LocalPort, State, OwningProcess | ConvertTo-Json"',
      { timeout: 10000 }
    )

    let raw = JSON.parse(stdout)
    if (!Array.isArray(raw)) raw = raw ? [raw] : []

    const connections: TcpConnection[] = raw.map((c: any) => ({
      remoteIp: c.RemoteAddress,
      remotePort: c.RemotePort,
      localPort: c.LocalPort,
      state: 'Established',
      pid: c.OwningProcess,
    }))

    // Intentar resolver nombres de proceso para los PIDs
    try {
      const pids = [...new Set(connections.map(c => c.pid).filter(Boolean))]
      if (pids.length > 0) {
        const pidFilter = pids.join(',')
        const { stdout: procOut } = await execAsync(
          `powershell -NoProfile -Command "Get-Process -Id ${pidFilter} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName | ConvertTo-Json"`,
          { timeout: 5000 }
        )
        let procs = JSON.parse(procOut)
        if (!Array.isArray(procs)) procs = procs ? [procs] : []
        const procMap = new Map(procs.map((p: any) => [p.Id, p.ProcessName]))
        for (const conn of connections) {
          if (conn.pid && procMap.has(conn.pid)) {
            conn.processName = procMap.get(conn.pid) as string
          }
        }
      }
    } catch {
      // No es crítico si no podemos resolver procesos
    }

    return connections
  } catch (error) {
    console.error('[DETECTION] Error capturando conexiones TCP:', error)
    return []
  }
}

// ─── Detección de anomalías por volumen ───────────────────────────────────────
interface VolumeAnomaly {
  ip: string
  connectionCount: number
  type: string
  severity: string
  description: string
}

function detectVolumeAnomalies(connections: TcpConnection[]): VolumeAnomaly[] {
  const anomalies: VolumeAnomaly[] = []

  // Contar conexiones por IP remota
  const ipCount = new Map<string, number>()
  for (const conn of connections) {
    if (isPrivateIp(conn.remoteIp)) continue
    ipCount.set(conn.remoteIp, (ipCount.get(conn.remoteIp) || 0) + 1)
  }

  // Detectar IPs con demasiadas conexiones (posible beaconing o C2)
  for (const [ip, count] of ipCount) {
    if (count >= 10) {
      anomalies.push({
        ip,
        connectionCount: count,
        type: 'Connection Flood / Beaconing',
        severity: count >= 20 ? 'high' : 'medium',
        description: `${count} conexiones simultáneas a ${ip} - patrón consistente con beaconing C2 o exfiltración de datos`,
      })
    }
  }

  // Detectar muchos puertos diferentes al mismo destino (port scan saliente)
  const ipPorts = new Map<string, Set<number>>()
  for (const conn of connections) {
    if (isPrivateIp(conn.remoteIp)) continue
    if (!ipPorts.has(conn.remoteIp)) ipPorts.set(conn.remoteIp, new Set())
    ipPorts.get(conn.remoteIp)!.add(conn.remotePort)
  }

  for (const [ip, ports] of ipPorts) {
    if (ports.size >= 8) {
      anomalies.push({
        ip,
        connectionCount: ports.size,
        type: 'Outbound Port Scan',
        severity: 'high',
        description: `Conexiones a ${ports.size} puertos diferentes en ${ip} - posible escaneo de puertos saliente o reconocimiento`,
      })
    }
  }

  return anomalies
}

// ─── Verificar si amenaza ya existe (deduplicación) ───────────────────────────
function threatExists(sourceIp: string, type: string): boolean {
  const existing = db.prepare(
    "SELECT id FROM Threat WHERE sourceIp = ? AND type = ? AND status NOT IN ('mitigated', 'resolved', 'false_positive') AND detectedAt > datetime('now', '-1 hour')"
  ).get(sourceIp, type)
  return !!existing
}

// ─── Crear amenaza real en la DB ──────────────────────────────────────────────
function createThreat(data: {
  type: string
  description: string
  severity: string
  sourceIp: string
  targetAsset: string
  protocol: string
  riskAnalysis: string
  raw?: string
}): string | null {
  // Deduplicar: no crear si ya existe una amenaza activa para esta IP + tipo
  if (threatExists(data.sourceIp, data.type)) {
    return null
  }

  const id = uuidv4()
  db.prepare(`
    INSERT INTO Threat (id, type, description, severity, status, sourceIp, targetAsset, protocol, riskAnalysis, raw, detectedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'analyzing', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(id, data.type, data.description, data.severity, data.sourceIp, data.targetAsset, data.protocol, data.riskAnalysis, data.raw || null)

  // Audit log
  db.prepare(`
    INSERT INTO AuditLog (id, action, entityType, entityId, details, threatId, createdAt)
    VALUES (?, 'threat.auto_detected', 'threat', ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(uuidv4(), id, JSON.stringify({ engine: 'petrol-ia-detection', sourceIp: data.sourceIp, type: data.type }), id)

  return id
}

// ─── CICLO PRINCIPAL DE DETECCIÓN ─────────────────────────────────────────────
export interface DetectionResult {
  timestamp: string
  connectionsAnalyzed: number
  publicIpsFound: number
  threatsCreated: number
  threats: Array<{ id: string; type: string; severity: string; sourceIp: string }>
  ipsChecked: number
  maliciousIps: number
  anomaliesDetected: number
  durationMs: number
}

export async function runDetectionCycle(): Promise<DetectionResult> {
  const startTime = Date.now()

  ensureReputationTable()

  const result: DetectionResult = {
    timestamp: new Date().toISOString(),
    connectionsAnalyzed: 0,
    publicIpsFound: 0,
    threatsCreated: 0,
    threats: [],
    ipsChecked: 0,
    maliciousIps: 0,
    anomaliesDetected: 0,
    durationMs: 0,
  }

  // 1. Capturar conexiones TCP reales
  const connections = await captureTcpConnections()
  result.connectionsAnalyzed = connections.length

  if (connections.length === 0) {
    result.durationMs = Date.now() - startTime
    return result
  }

  // 2. Análisis de puertos sospechosos
  for (const conn of connections) {
    const portInfo = SUSPICIOUS_PORTS[conn.remotePort]
    if (portInfo) {
      const threatId = createThreat({
        type: portInfo.type,
        description: `${portInfo.description}. Proceso: ${conn.processName || 'PID ' + conn.pid || 'desconocido'}. Conexión ${conn.remoteIp}:${conn.remotePort} desde puerto local ${conn.localPort}.`,
        severity: portInfo.severity,
        sourceIp: conn.remoteIp,
        targetAsset: `localhost:${conn.localPort}`,
        protocol: `TCP/${conn.remotePort}`,
        riskAnalysis: generateRiskAnalysis(portInfo.type, portInfo.severity, conn),
        raw: JSON.stringify(conn),
      })

      if (threatId) {
        result.threatsCreated++
        result.threats.push({ id: threatId, type: portInfo.type, severity: portInfo.severity, sourceIp: conn.remoteIp })
      }
    }
  }

  // 3. Análisis de volumen (beaconing, port scan)
  const volumeAnomalies = detectVolumeAnomalies(connections)
  result.anomaliesDetected = volumeAnomalies.length

  for (const anomaly of volumeAnomalies) {
    const threatId = createThreat({
      type: anomaly.type,
      description: anomaly.description,
      severity: anomaly.severity,
      sourceIp: anomaly.ip,
      targetAsset: 'Red Local',
      protocol: 'TCP (múltiples)',
      riskAnalysis: `Anomalía de volumen detectada: ${anomaly.connectionCount} conexiones. ${anomaly.severity === 'high' ? 'Requiere investigación inmediata.' : 'Monitorear comportamiento.'}`,
    })

    if (threatId) {
      result.threatsCreated++
      result.threats.push({ id: threatId, type: anomaly.type, severity: anomaly.severity, sourceIp: anomaly.ip })
    }
  }

  // 4. Chequeo de reputación de IPs públicas contra AbuseIPDB
  const publicIps = new Set<string>()
  for (const conn of connections) {
    if (!isPrivateIp(conn.remoteIp)) {
      publicIps.add(conn.remoteIp)
    }
  }
  result.publicIpsFound = publicIps.size

  for (const ip of publicIps) {
    // Primero buscar en caché
    let reputation = getCachedReputation(ip)

    if (!reputation) {
      // Consultar AbuseIPDB
      reputation = await checkAbuseIPDB(ip)
      if (reputation) {
        cacheReputation(reputation)
        result.ipsChecked++
      }
    }

    if (reputation && reputation.isMalicious) {
      result.maliciousIps++

      // Encontrar la conexión original para contexto
      const conn = connections.find(c => c.remoteIp === ip)

      const threatId = createThreat({
        type: 'IP Maliciosa (Threat Intel)',
        description: `Conexión activa a IP reportada como maliciosa: ${ip} (${reputation.country}/${reputation.isp}). AbuseIPDB confidence: ${reputation.abuseScore}%. Proceso: ${conn?.processName || 'desconocido'}.`,
        severity: reputation.abuseScore >= 80 ? 'critical' : 'high',
        sourceIp: ip,
        targetAsset: conn ? `localhost:${conn.localPort}` : 'Red Local',
        protocol: conn ? `TCP/${conn.remotePort}` : 'TCP',
        riskAnalysis: `IP ${ip} tiene un score de abuso de ${reputation.abuseScore}% en AbuseIPDB. País: ${reputation.country}. ISP: ${reputation.isp}. Se recomienda bloquear inmediatamente y analizar el proceso que generó la conexión.`,
        raw: JSON.stringify(reputation),
      })

      if (threatId) {
        result.threatsCreated++
        result.threats.push({ id: threatId, type: 'IP Maliciosa (Threat Intel)', severity: reputation.abuseScore >= 80 ? 'critical' : 'high', sourceIp: ip })
      }
    }
  }

  result.durationMs = Date.now() - startTime
  return result
}

// ─── Generador de análisis de riesgo contextual ──────────────────────────────
function generateRiskAnalysis(type: string, severity: string, conn: TcpConnection): string {
  const base = severity === 'critical'
    ? 'CRITICO: Requiere acción inmediata.'
    : severity === 'high'
      ? 'ALTO: Requiere investigación urgente.'
      : 'MEDIO: Monitorear y analizar.'

  const processInfo = conn.processName
    ? `Proceso identificado: ${conn.processName} (PID ${conn.pid}).`
    : conn.pid
      ? `PID del proceso: ${conn.pid}. Identificar proceso manualmente.`
      : 'Proceso no identificado.'

  if (type.includes('C2') || type.includes('Backdoor')) {
    return `${base} Conexión a puerto ${conn.remotePort} (${conn.remoteIp}) asociado a herramientas de acceso remoto. ${processInfo} Verificar si el proceso es legítimo. Si no es reconocido, aislar el equipo inmediatamente y realizar análisis forense.`
  }

  if (type.includes('Crypto')) {
    return `${base} Tráfico hacia pool de minería detectado (${conn.remoteIp}:${conn.remotePort}). ${processInfo} Minería no autorizada consume recursos y puede indicar compromiso previo del sistema.`
  }

  if (type.includes('Modbus') || type.includes('S7') || type.includes('DNP3') || type.includes('OPC') || type.includes('IEC')) {
    return `${base} Protocolo industrial expuesto en ${conn.remoteIp}:${conn.remotePort}. ${processInfo} Protocolos OT/ICS no deben ser accesibles desde la red corporativa. Posible violación de segmentación IT/OT.`
  }

  if (type.includes('DNS')) {
    return `${base} Conexión TCP al puerto DNS (${conn.remoteIp}:53). DNS sobre TCP puede indicar tunneling para exfiltración de datos. ${processInfo} Analizar volumen y contenido de queries.`
  }

  return `${base} ${processInfo} Conexión a ${conn.remoteIp}:${conn.remotePort} requiere análisis.`
}
