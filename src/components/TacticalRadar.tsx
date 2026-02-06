'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface RadarDevice {
  ip: string
  mac?: string
  hostname?: string
  type: string
  vendor?: string
  openPorts?: string
  lastSeen: string
  firstSeen: string
  isOnline: boolean
  riskLevel: string
  networkSegment?: string
  distanceKm?: number | null
  city?: string | null
  country?: string | null
}

interface RadarThreat {
  id: string
  type: string
  severity: string
  sourceIp: string
  targetAsset: string
  status: string
}

interface TacticalRadarProps {
  devices: RadarDevice[]
  threats: RadarThreat[]
  location: { city?: string; lat?: number; lon?: number } | null
  detectionRunning: boolean
  maxDistanceKm?: number
}

const CX = 200
const CY = 200
const R = 180

const RINGS = [0.2, 0.4, 0.6, 0.8, 1.0]
const CARDINALS = [
  { label: 'N', angle: -90 },
  { label: 'E', angle: 0 },
  { label: 'S', angle: 90 },
  { label: 'W', angle: -180 },
]

function severityColor(s: string): string {
  if (s === 'critical') return '#ff2d2d'
  if (s === 'high') return '#ef4444'
  if (s === 'medium') return '#f59e0b'
  return '#3b82f6'
}

function riskColor(r: string): string {
  if (r === 'critical') return '#ff2d2d'
  if (r === 'high') return '#f97316'
  if (r === 'medium') return '#f59e0b'
  return '#10b981'
}

function typeIcon(type: string): string {
  switch (type) {
    case 'plc': return '\u25A0'      // filled square
    case 'rtu': return '\u25C6'      // diamond
    case 'hmi': return '\u25B2'      // triangle
    case 'server': return '\u25CF'   // filled circle
    case 'switch': return '\u2B22'   // hexagon
    case 'router': return '\u2B21'   // hexagon outline
    case 'workstation': return '\u25A1' // square outline
    case 'iot': return '\u2022'      // bullet
    default: return '\u25CB'         // circle outline
  }
}

// Hash IP to stable angle
function ipToSeed(ip: string): number {
  const parts = ip.split('.').map(Number)
  return ((parts[0] || 0) * 7 + (parts[1] || 0) * 13 + (parts[2] || 0) * 256 + (parts[3] || 0)) & 0xFFFF
}

function isPrivateIp(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p[0] === 10) return true
  if (p[0] === 127) return true
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
  if (p[0] === 192 && p[1] === 168) return true
  return false
}

// Position device on radar: private IPs use hash, public IPs use real distance
function deviceToPosition(device: RadarDevice, maxDist: number): { angle: number; dist: number } {
  const seed = ipToSeed(device.ip)
  const angle = (seed * 137.508) % 360

  // Public IPs with real distance → proportional placement
  if (!isPrivateIp(device.ip) && device.distanceKm && maxDist > 0) {
    const dist = 0.15 + (device.distanceKm / maxDist) * 0.75
    return { angle, dist: Math.min(dist, 0.92) }
  }

  // Private/local IPs → inner rings (closer to center)
  if (isPrivateIp(device.ip)) {
    const dist = 0.1 + ((seed * 31) % 30) / 100
    return { angle, dist: Math.min(dist, 0.35) }
  }

  // Public IP without distance data → mid-outer zone
  const dist = 0.4 + ((seed * 31) % 45) / 100
  return { angle, dist: Math.min(dist, 0.9) }
}

function polarToXY(angleDeg: number, distRatio: number): { x: number; y: number } {
  const rad = (angleDeg - 90) * Math.PI / 180
  return {
    x: CX + R * distRatio * Math.cos(rad),
    y: CY + R * distRatio * Math.sin(rad),
  }
}

export default function TacticalRadar({ devices, threats, location, detectionRunning, maxDistanceKm = 0 }: TacticalRadarProps) {
  const [sweepAngle, setSweepAngle] = useState(0)
  const [hoveredItem, setHoveredItem] = useState<any>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const frameRef = useRef<number>(0)

  // Smooth sweep animation
  useEffect(() => {
    let lastTime = 0
    const animate = (time: number) => {
      if (lastTime) {
        const delta = time - lastTime
        setSweepAngle(prev => (prev + delta * 0.04) % 360)
      }
      lastTime = time
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  // Check if angle is in the sweep trail
  const getIllumination = (itemAngle: number): number => {
    const diff = (sweepAngle - itemAngle + 360) % 360
    if (diff < 50) return 1 - diff / 50
    return 0
  }

  // Build sweep path (pie slice with gradient fade)
  const sweepRad = (sweepAngle - 90) * Math.PI / 180
  const sweepTrailRad = ((sweepAngle - 50) - 90) * Math.PI / 180
  const sweepX1 = CX + R * Math.cos(sweepTrailRad)
  const sweepY1 = CY + R * Math.sin(sweepTrailRad)
  const sweepX2 = CX + R * Math.cos(sweepRad)
  const sweepY2 = CY + R * Math.sin(sweepRad)

  const parsePorts = (portsStr?: string): string => {
    if (!portsStr) return 'N/A'
    try { return JSON.parse(portsStr).join(', ') } catch { return portsStr }
  }

  return (
    <div style={{ position: 'relative', background: '#040a06', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header HUD */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1rem', borderBottom: '1px solid rgba(16,185,129,0.15)',
        background: 'rgba(0,0,0,0.4)', position: 'relative', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: detectionRunning ? '#f59e0b' : '#10b981',
            boxShadow: `0 0 8px ${detectionRunning ? '#f59e0b' : '#10b981'}`,
            animation: detectionRunning ? 'pulse 1s infinite' : 'none'
          }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.1em' }}>
            SONAR GEOPROPOCIONAL
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', fontSize: '0.55rem', opacity: 0.6, fontFamily: 'monospace', textAlign: 'right' }}>
          <div>{location?.city || 'Buenos Aires'} ({location?.lat?.toFixed(2)}, {location?.lon?.toFixed(2)})</div>
          <div style={{ fontSize: '0.45rem', opacity: 0.5, letterSpacing: '0.05em' }}>DISTANCIAS CALCULADAS POR GEOLOCALIZACIÓN IP</div>
        </div>
      </div>

      {/* SVG Radar */}
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={handleMouseMove}
      >
        <defs>
          {/* Sweep gradient */}
          <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.12" />
          </radialGradient>

          {/* Glow filter for nodes */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glowStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Scan line glow */}
          <linearGradient id="scanLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
          </linearGradient>

          {/* Background gradient */}
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a1a10" />
            <stop offset="60%" stopColor="#060e09" />
            <stop offset="100%" stopColor="#030705" />
          </radialGradient>

          {/* Clip to circle */}
          <clipPath id="radarClip">
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>
        </defs>

        {/* Background */}
        <circle cx={CX} cy={CY} r={R} fill="url(#bgGrad)" stroke="rgba(16,185,129,0.2)" strokeWidth="1.5" />

        {/* Grid group clipped to circle */}
        <g clipPath="url(#radarClip)">
          {/* Distance rings */}
          {RINGS.map((ring) => (
            <circle
              key={ring}
              cx={CX} cy={CY}
              r={R * ring}
              fill="none"
              stroke="rgba(16,185,129,0.08)"
              strokeWidth={ring === 1 ? 1.5 : 0.5}
              strokeDasharray={ring < 1 ? '2,4' : undefined}
            />
          ))}

          {/* Crosshair lines */}
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(16,185,129,0.08)" strokeWidth="0.5" />
          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(16,185,129,0.08)" strokeWidth="0.5" />

          {/* Diagonal crosshairs */}
          <line x1={CX - R * 0.707} y1={CY - R * 0.707} x2={CX + R * 0.707} y2={CY + R * 0.707} stroke="rgba(16,185,129,0.04)" strokeWidth="0.5" />
          <line x1={CX + R * 0.707} y1={CY - R * 0.707} x2={CX - R * 0.707} y2={CY + R * 0.707} stroke="rgba(16,185,129,0.04)" strokeWidth="0.5" />

          {/* Sweep trail (conic section) */}
          <path
            d={`M ${CX} ${CY} L ${sweepX1} ${sweepY1} A ${R} ${R} 0 0 1 ${sweepX2} ${sweepY2} Z`}
            fill="url(#sweepGrad)"
          />

          {/* Sweep line (leading edge) */}
          <line
            x1={CX} y1={CY}
            x2={sweepX2} y2={sweepY2}
            stroke="#10b981"
            strokeWidth="1.5"
            opacity="0.6"
            filter="url(#glow)"
          />

          {/* Device nodes */}
          {devices.map((device) => {
            const pos = deviceToPosition(device, maxDistanceKm)
            const { x, y } = polarToXY(pos.angle, pos.dist)
            const illum = getIllumination(pos.angle)
            const color = riskColor(device.riskLevel)
            const isHovered = hoveredItem?.ip === device.ip

            return (
              <g
                key={device.ip}
                opacity={illum > 0.1 ? 0.3 + illum * 0.7 : 0.12}
                style={{ cursor: 'pointer', transition: 'opacity 0.3s' }}
                onMouseEnter={() => setHoveredItem({
                  type: 'device', ip: device.ip, hostname: device.hostname,
                  deviceType: device.type, vendor: device.vendor, mac: device.mac,
                  riskLevel: device.riskLevel, segment: device.networkSegment,
                  ports: parsePorts(device.openPorts), isOnline: device.isOnline,
                  firstSeen: device.firstSeen, x, y,
                  distanceKm: device.distanceKm, city: device.city, country: device.country,
                })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Glow ring when illuminated */}
                {illum > 0.3 && (
                  <circle cx={x} cy={y} r={8} fill="none" stroke={color} strokeWidth="0.5"
                    opacity={illum * 0.4} filter="url(#glow)" />
                )}

                {/* Node dot */}
                <circle
                  cx={x} cy={y}
                  r={isHovered ? 5 : device.riskLevel === 'critical' ? 4 : 3}
                  fill={color}
                  filter={illum > 0.3 ? 'url(#glow)' : undefined}
                  stroke={isHovered ? '#fff' : 'none'}
                  strokeWidth={isHovered ? 1.5 : 0}
                />

                {/* Type icon */}
                <text x={x} y={y + 1.5} textAnchor="middle" fontSize="5" fill="#fff"
                  opacity={illum > 0.5 ? 0.9 : 0} style={{ transition: 'opacity 0.3s', pointerEvents: 'none' }}>
                  {typeIcon(device.type)}
                </text>

                {/* Label when illuminated */}
                {illum > 0.5 && !hoveredItem && (
                  <g opacity={illum}>
                    <rect x={x - 30} y={y + 8} width="60" height="14" rx="2"
                      fill="rgba(0,0,0,0.85)" stroke={`${color}44`} strokeWidth="0.5" />
                    <text x={x} y={y + 17} textAnchor="middle" fontSize="5.5" fill={color}
                      fontWeight="600" fontFamily="monospace" style={{ pointerEvents: 'none' }}>
                      {(device.hostname || device.ip).substring(0, 18)}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* Threat markers */}
          {threats.map((threat) => {
            const seed = ipToSeed(threat.sourceIp)
            const angle = (seed * 137.508) % 360
            // Threats in outer zone
            const dist = isPrivateIp(threat.sourceIp) ? 0.35 + ((seed * 17) % 25) / 100 : 0.6 + ((seed * 17) % 30) / 100
            const { x, y } = polarToXY(angle, Math.min(dist, 0.95))
            const illum = getIllumination(angle)
            const color = severityColor(threat.severity)
            const isHovered = hoveredItem?.id === threat.id

            return (
              <g
                key={threat.id}
                opacity={illum > 0.1 ? 0.4 + illum * 0.6 : 0.15}
                style={{ cursor: 'pointer', transition: 'opacity 0.3s' }}
                onMouseEnter={() => setHoveredItem({
                  type: 'threat', id: threat.id, threatType: threat.type,
                  severity: threat.severity, sourceIp: threat.sourceIp,
                  targetAsset: threat.targetAsset, x, y,
                })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Danger pulse ring */}
                {illum > 0.3 && (
                  <>
                    <circle cx={x} cy={y} r={12} fill="none" stroke={color} strokeWidth="0.5"
                      opacity={illum * 0.3}>
                      <animate attributeName="r" values="6;14" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values={`${illum * 0.4};0`} dur="2s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}

                {/* Threat diamond marker */}
                <polygon
                  points={`${x},${y - (isHovered ? 6 : 5)} ${x + (isHovered ? 6 : 5)},${y} ${x},${y + (isHovered ? 6 : 5)} ${x - (isHovered ? 6 : 5)},${y}`}
                  fill={color}
                  filter={illum > 0.3 ? 'url(#glowStrong)' : undefined}
                  stroke={isHovered ? '#fff' : `${color}88`}
                  strokeWidth={isHovered ? 1.5 : 0.5}
                />

                {/* X mark inside for threats */}
                <text x={x} y={y + 2} textAnchor="middle" fontSize="6" fill="#fff"
                  fontWeight="700" opacity={0.9} style={{ pointerEvents: 'none' }}>
                  !
                </text>

                {/* Label */}
                {illum > 0.4 && !hoveredItem && (
                  <g opacity={illum}>
                    <rect x={x - 35} y={y + 9} width="70" height="14" rx="2"
                      fill="rgba(0,0,0,0.9)" stroke={color} strokeWidth="0.5" />
                    <text x={x} y={y + 18} textAnchor="middle" fontSize="5" fill={color}
                      fontWeight="700" fontFamily="monospace" style={{ pointerEvents: 'none' }}>
                      {threat.type.substring(0, 20).toUpperCase()}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>

        {/* Cardinal labels (outside clip) */}
        {CARDINALS.map(({ label, angle }) => {
          const { x, y } = polarToXY(angle, 1.06)
          return (
            <text key={label} x={x} y={y + 2} textAnchor="middle" fontSize="8"
              fill="rgba(16,185,129,0.35)" fontWeight="600" fontFamily="monospace">
              {label}
            </text>
          )
        })}

        {/* Ring distance labels */}
        {RINGS.filter(r => r < 1).map(ring => {
          const label = maxDistanceKm > 0
            ? `${Math.round(ring * maxDistanceKm).toLocaleString()} km`
            : `${(ring * 100).toFixed(0)}`
          return (
            <text key={ring} x={CX + 4} y={CY - R * ring + 10} fontSize="5"
              fill="rgba(16,185,129,0.25)" fontFamily="monospace">
              {label}
            </text>
          )
        })}

        {/* Center node */}
        <circle cx={CX} cy={CY} r={6} fill="#fff" opacity="0.9" filter="url(#glow)" />
        <circle cx={CX} cy={CY} r={3} fill="#10b981" />
        <circle cx={CX} cy={CY} r={12} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5">
          <animate attributeName="r" values="8;16;8" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Status bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.5rem 1rem', borderTop: '1px solid rgba(16,185,129,0.15)',
        background: 'rgba(0,0,0,0.4)', fontSize: '0.6rem', fontFamily: 'monospace'
      }}>
        <span style={{ color: '#10b981', opacity: 0.7 }}>
          {devices.length > 0 ? `${devices.filter(d => d.isOnline).length} ONLINE / ${devices.length} TOTAL` : 'SCANNING...'}
        </span>
        {maxDistanceKm > 0 && (
          <span style={{ color: '#10b981', opacity: 0.5 }}>
            ALCANCE GEO: {Math.round(maxDistanceKm).toLocaleString()} KM
          </span>
        )}
        <span style={{ color: threats.length > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
          {threats.length > 0 ? `${threats.length} THREAT${threats.length > 1 ? 'S' : ''} ACTIVE` : 'ALL CLEAR'}
        </span>
      </div>

      {/* Hover tooltip */}
      {hoveredItem && (
        <div style={{
          position: 'absolute',
          top: '3.5rem',
          right: '0.75rem',
          width: 200,
          background: 'rgba(2, 10, 5, 0.97)',
          border: `1px solid ${hoveredItem.type === 'threat' ? severityColor(hoveredItem.severity) : riskColor(hoveredItem.riskLevel || 'low')}`,
          borderRadius: 6,
          padding: '0.75rem',
          zIndex: 30,
          boxShadow: `0 0 20px ${hoveredItem.type === 'threat' ? severityColor(hoveredItem.severity) : riskColor(hoveredItem.riskLevel || 'low')}22`,
          backdropFilter: 'blur(12px)',
          fontFamily: 'monospace',
        }}>
          {hoveredItem.type === 'device' ? (
            <>
              <div style={{ borderBottom: '1px solid rgba(16,185,129,0.2)', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: riskColor(hoveredItem.riskLevel) }}>
                  {hoveredItem.hostname || hoveredItem.ip}
                </div>
                <div style={{ fontSize: '0.55rem', opacity: 0.5 }}>{hoveredItem.deviceType?.toUpperCase()} {hoveredItem.vendor ? `(${hoveredItem.vendor})` : ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.6rem' }}>
                <Row label="IP" value={hoveredItem.ip} />
                {hoveredItem.mac && <Row label="MAC" value={hoveredItem.mac} />}
                <Row label="ESTADO" value={hoveredItem.isOnline ? 'ONLINE' : 'OFFLINE'} color={hoveredItem.isOnline ? '#10b981' : '#ef4444'} />
                {hoveredItem.segment && <Row label="SEGMENTO" value={hoveredItem.segment} />}
                <Row label="RIESGO" value={hoveredItem.riskLevel?.toUpperCase()} color={riskColor(hoveredItem.riskLevel)} />
                {hoveredItem.distanceKm && <Row label="DISTANCIA GEO" value={`${Math.round(hoveredItem.distanceKm).toLocaleString()} km`} color="#10b981" />}
                {hoveredItem.city && <Row label="LOCALIZACIÓN" value={`${hoveredItem.city}, ${hoveredItem.country || ''}`} />}
                <div style={{ marginTop: '0.2rem', paddingTop: '0.3rem', borderTop: '1px solid rgba(16,185,129,0.1)' }}>
                  <div style={{ fontSize: '0.5rem', opacity: 0.4, marginBottom: 2 }}>PUERTOS</div>
                  <div style={{ color: '#10b981', fontSize: '0.55rem', wordBreak: 'break-all' }}>{hoveredItem.ports}</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid rgba(239,68,68,0.3)', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: severityColor(hoveredItem.severity) }}>
                  {hoveredItem.threatType}
                </div>
                <div style={{ fontSize: '0.55rem', opacity: 0.5 }}>AMENAZA ACTIVA</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.6rem' }}>
                <Row label="ORIGEN" value={hoveredItem.sourceIp} color="#ef4444" />
                <Row label="DESTINO" value={hoveredItem.targetAsset} />
                <Row label="SEVERIDAD" value={hoveredItem.severity?.toUpperCase()} color={severityColor(hoveredItem.severity)} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
      <span style={{ opacity: 0.5, flexShrink: 0 }}>{label}</span>
      <span style={{ color: color || 'inherit', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  )
}
