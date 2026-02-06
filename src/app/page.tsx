'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import TacticalRadar from '@/components/TacticalRadar'

interface Threat {
  id: string
  type: string
  description: string
  severity: string
  status: string
  sourceIp: string
  targetAsset: string
  protocol: string | null
  riskAnalysis: string | null
  detectedAt: string
  mitigatedAt: string | null
  mitigatedBy: { id: string; name: string } | null
  contractor: { id: string; name: string } | null
}

interface ContractorInfo {
  id: string
  name: string
  healthScore: number
  status: string
  riskLevel: string
}

interface DashboardStats {
  activeThreats: number
  totalThreats: number
  openIncidents: number
  vendorHealth: number
  contractors: ContractorInfo[]
  recentActivity: any[]
  mitigatedToday: number
}

interface LogEntry {
  time: string
  msg: string
  type: string
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('summary')
  const [threats, setThreats] = useState<Threat[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null)
  const [networkData, setNetworkData] = useState<number[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: 'Sistema SOC Inicializado (Modo Real). Sin amenazas detectadas.', type: 'system' }
  ])

  const [jitStep, setJitStep] = useState(0)
  const [threatIntel, setThreatIntel] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  // sonarAngle y hoveredNode ahora son internos del componente TacticalRadar
  const [radarDevices, setRadarDevices] = useState<any[]>([])
  const [detectionRunning, setDetectionRunning] = useState(false)
  const [lastDetection, setLastDetection] = useState<any>(null)
  const [maxDistanceKm, setMaxDistanceKm] = useState(0)

  const addLog = useCallback((msg: string, type: string = 'system') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 10))
  }, [])

  // Geolocalización real
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        setLocation(data)
        addLog(`Ubicación detectada: ${data.city}, ${data.country_name}`, 'system')
      })
      .catch(() => {
        setLocation({ city: 'Buenos Aires', lat: -34.60, lon: -58.38 })
        addLog('Ubicación predeterminada: Buenos Aires (Sede Central)', 'system')
      })
  }, [addLog])

  // Fetch amenazas reales de la DB
  const fetchThreats = useCallback(async () => {
    try {
      const res = await fetch('/api/threats?limit=30')
      if (res.ok) {
        const data = await res.json()
        setThreats(data)
      }
    } catch (e) {
      console.error('Error fetching threats:', e)
    }
  }, [])

  // Fetch stats del dashboard
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (e) {
      console.error('Error fetching stats:', e)
    }
  }, [])

  // Fetch trafico de red real
  const fetchTraffic = useCallback(async () => {
    try {
      const res = await fetch('/api/network/traffic')
      const traffic = await res.json()
      if (!traffic.error && Array.isArray(traffic)) {
        const chartValues = traffic.map((c: any) => (c.localPort % 100))
        setNetworkData(prev => [...prev.slice(-10), ...chartValues].slice(-26))
      }
    } catch (e) {
      // Silenciar error de red en non-Windows
    }
  }, [])

  // Polling de threat intel real (Informativo)
  const fetchThreatIntel = useCallback(async () => {
    try {
      const res = await fetch('/api/threat-intel')
      const intel = await res.json()
      setThreatIntel(intel)
    } catch (e) {
      console.error('Error fetching threat intel:', e)
    }
  }, [])

  // Ejecutar ciclo de detección real
  const runDetection = useCallback(async () => {
    if (detectionRunning) return
    setDetectionRunning(true)
    try {
      const res = await fetch('/api/detection/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location?.lat, lon: location?.lon }),
      })
      if (res.ok) {
        const data = await res.json()
        setLastDetection(data.detection)
        if (data.detection?.threatsCreated > 0) {
          addLog(`Motor de detección: ${data.detection.threatsCreated} amenaza(s) detectada(s) en ${data.detection.connectionsAnalyzed} conexiones`, 'alert')
          fetchThreats()
          fetchStats()
        } else {
          addLog(`Escaneo completado: ${data.detection?.connectionsAnalyzed || 0} conexiones analizadas. Sin amenazas nuevas.`, 'system')
        }
        if (data.discovery?.maxDistanceKm > 0) {
          setMaxDistanceKm(data.discovery.maxDistanceKm)
          addLog(`Alcance geográfico de conexiones: ${Math.round(data.discovery.maxDistanceKm).toLocaleString()} km`, 'system')
        }
        if (data.discovery?.newDevices > 0) {
          addLog(`Descubrimiento de red: ${data.discovery.newDevices} dispositivo(s) nuevo(s) encontrado(s)`, 'system')
        }
      }
    } catch (e) {
      console.error('Detection error:', e)
    } finally {
      setDetectionRunning(false)
    }
  }, [detectionRunning, addLog, fetchThreats, fetchStats, location])

  // Fetch dispositivos reales para el radar
  const fetchRadarDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/detection/scan')
      if (res.ok) {
        const data = await res.json()
        if (data.radarDevices) {
          setRadarDevices(data.radarDevices)
        }
        if (data.maxDistanceKm > 0) {
          setMaxDistanceKm(data.maxDistanceKm)
        }
      }
    } catch (e) {
      // Silenciar
    }
  }, [])

  // Polling principal
  useEffect(() => {
    fetchThreats()
    fetchStats()
    fetchTraffic()
    fetchRadarDevices()

    const interval = setInterval(() => {
      fetchThreats()
      fetchStats()
      fetchTraffic()
      fetchRadarDevices()
    }, 6000)

    return () => clearInterval(interval)
  }, [activeTab, fetchThreats, fetchStats, fetchTraffic, fetchThreatIntel, fetchRadarDevices])

  // Ciclo de detección automático cada 30 segundos
  useEffect(() => {
    // Ejecutar primera detección al cargar
    const timer = setTimeout(() => runDetection(), 3000)

    const detectionInterval = setInterval(() => {
      runDetection()
    }, 30000)

    return () => {
      clearTimeout(timer)
      clearInterval(detectionInterval)
    }
  }, [runDetection])

  // Mitigar amenaza REAL
  const mitigateThreat = async (id: string) => {
    try {
      const res = await fetch(`/api/threats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'mitigated' }),
      })

      if (res.ok) {
        addLog('Amenaza mitigada y registrada en base de datos.', 'system')
        fetchThreats()
        fetchStats()
      }
    } catch (e) {
      addLog('Error al mitigar amenaza.', 'alert')
    }
  }

  // Escaneo de red
  const runScan = async () => {
    setIsScanning(true)
    addLog('Creando Job de escaneo en el Hub...', 'system')
    try {
      const res = await fetch('/api/network/scan', { method: 'POST' })
      const data = await res.json()
      const jobId = data.jobId
      if (!jobId) throw new Error('No se pudo crear el Job')

      addLog(`Job [${jobId}] creado. Esperando al Conector...`, 'system')

      const pollInterval = setInterval(async () => {
        const checkRes = await fetch(`/api/jobs?id=${jobId}`)
        const job = await checkRes.json()

        if (job.status === 'completed') {
          clearInterval(pollInterval)
          setIsScanning(false)
          addLog('Escaneo finalizado por el Conector.', 'system')
          if (job.result?.hosts) {
            addLog(`${job.result.hosts.length} hosts detectados en red local.`, 'system')
          }
        } else if (job.status === 'failed') {
          clearInterval(pollInterval)
          setIsScanning(false)
          addLog('Error: El conector falló en la ejecución del Job.', 'alert')
        }
      }, 2000)
    } catch (e) {
      addLog('Error al contactar con el Hub.', 'alert')
      setIsScanning(false)
    }
  }

  // JIT workflow
  const runWorkflow = () => {
    if (jitStep === 0) {
      setJitStep(1)
      addLog('Acceso Denegado: PetroServicios S.A. (Score < 70%)', 'alert')
    } else if (jitStep === 1) {
      setJitStep(2)
      addLog('Parches Aplicados: PetroServicios Score -> 95%', 'system')
    } else if (jitStep === 2) {
      setJitStep(3)
      addLog('Solicitud JIT Enviada: Acceso a SCADA-04 (2h)', 'system')
    } else if (jitStep === 3) {
      setJitStep(4)
      addLog('Acceso JIT Aprobado por: Ing. Martínez (Supervisor)', 'system')
    } else {
      setJitStep(0)
      addLog('Sesión JIT Terminada automáticamente.', 'alert')
    }
  }

  const activeThreats = threats.filter(t => t.status !== 'mitigated' && t.status !== 'resolved' && t.status !== 'false_positive')
  const mitigatedThreats = threats.filter(t => t.status === 'mitigated' || t.status === 'resolved')

  const severityColor = (s: string) => {
    if (s === 'critical' || s === 'high') return '#ef4444'
    if (s === 'medium') return 'var(--accent-orange)'
    return 'var(--accent-blue)'
  }

  return (
    <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Petrol-IA</h1>
          <p style={{ opacity: 0.6, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            SaaS de Gobernanza de Terceros & Zero Trust
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="glass" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="status-ring status-online pulse-icon"></span>
              <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>SOC Activo</span>
            </div>
            <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Cuenca Neuquina</div>
          </div>
          <div className="glass" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{session?.user?.name}</span>
            <button
              onClick={() => signOut()}
              style={{ padding: '0.3rem 0.6rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }}
            >
              SALIR
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tabs-header" aria-label="Navegación del Dashboard">
        {[
          { key: 'summary', label: 'VISTA GENERAL' },
          { key: 'soc', label: 'SOC DE DETECCIÓN' },
          { key: 'jit', label: 'ACCESO JIT' },
          { key: 'reports', label: 'REPORTES' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Stats Bar */}
      <div role="region" aria-label="Estadísticas Clave" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass cyber-border" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Amenazas Activas</h3>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: (stats?.activeThreats || 0) > 0 ? '#ef4444' : 'var(--accent-green)' }}>
            {stats?.activeThreats ?? '-'}
          </div>
        </div>
        <div className="glass cyber-border" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Incidentes Abiertos</h3>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: (stats?.openIncidents || 0) > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
            {stats?.openIncidents ?? '-'}
          </div>
        </div>
        <div className="glass cyber-border" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Vendor Health</h3>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats?.vendorHealth ?? '-'}%</div>
        </div>
        <div className="glass cyber-border" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Mitigadas Hoy</h3>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{stats?.mitigatedToday ?? '-'}</div>
        </div>
      </div>

      {/* ═══════════ VISTA GENERAL ═══════════ */}
      {activeTab === 'summary' && (
        <div role="tabpanel" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section className="glass grid-bg" style={{ padding: '2rem', minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
              <div className="scan-line" aria-hidden="true"></div>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Estado de Red Operativa (Live Data)</h2>
              <div role="img" aria-label="Gráfico de tráfico de red" style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                {networkData.map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--accent-blue)', opacity: 0.3 + (h / 150), borderRadius: '2px 2px 0 0', transition: 'all 0.5s ease' }}></div>
                ))}
                {networkData.length === 0 && (
                  <div style={{ flex: 1, textAlign: 'center', opacity: 0.3, paddingTop: '3rem' }}>Esperando datos de red...</div>
                )}
              </div>
            </section>

            <section className="glass" style={{ padding: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Estatus de Contratistas</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', opacity: 0.5 }}>
                    <th scope="col" style={{ paddingBottom: '0.75rem' }}>PROVEEDOR</th>
                    <th scope="col" style={{ paddingBottom: '0.75rem' }}>SCORE</th>
                    <th scope="col" style={{ paddingBottom: '0.75rem' }}>RIESGO</th>
                    <th scope="col" style={{ paddingBottom: '0.75rem' }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.contractors || []).map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 0', fontSize: '0.9rem' }}>{c.name}</td>
                      <td style={{ padding: '1rem 0', color: c.healthScore < 70 ? '#ef4444' : 'var(--accent-green)' }}>{c.healthScore}%</td>
                      <td style={{ padding: '1rem 0', fontSize: '0.8rem', color: severityColor(c.riskLevel) }}>{c.riskLevel.toUpperCase()}</td>
                      <td style={{ padding: '1rem 0', fontSize: '0.8rem' }}>{c.status.toUpperCase()}</td>
                    </tr>
                  ))}
                  {(!stats?.contractors || stats.contractors.length === 0) && (
                    <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', opacity: 0.4 }}>Sin contratistas registrados</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section className="glass" style={{ padding: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Alertas de Contexto</h2>
              <article className="alert-card">
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>INTELIGENCIA CERT.AR</h3>
                <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Incremento del 13% en ataques al sector energético en Argentina.</p>
              </article>
            </section>

            <section className="glass" style={{ padding: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Actividad Reciente</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(stats?.recentActivity || []).slice(0, 5).map((a: any) => (
                  <div key={a.id} style={{ fontSize: '0.75rem', padding: '0.5rem', borderLeft: '2px solid var(--accent-blue)', paddingLeft: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{a.action}</div>
                    <div style={{ opacity: 0.5 }}>{a.user?.name} - {new Date(a.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
                {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                  <div style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sin actividad reciente</div>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* ═══════════ SOC DE DETECCIÓN ═══════════ */}
      {activeTab === 'soc' && (
        <div role="tabpanel" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', minHeight: 'calc(100vh - 380px)' }}>
          <section className="glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Detección de Amenazas en Tiempo Real</h2>

            <div style={{ flex: 1, maxHeight: '480px', overflowY: 'auto', paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', scrollbarWidth: 'thin', scrollbarColor: 'var(--accent-blue) transparent' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                Incidentes Activos ({activeThreats.length})
              </div>
              {activeThreats.map((t) => (
                <article key={t.id} className="glass" style={{ padding: '1.25rem', borderLeft: `4px solid ${severityColor(t.severity)}`, position: 'relative', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.type}</h3>
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                      {new Date(t.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {t.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem', opacity: 0.8 }}>
                    <div>ORIGEN: <span style={{ color: severityColor(t.severity) }}>{t.sourceIp}</span></div>
                    <div>DESTINO: <span className="threat-low">{t.targetAsset}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button
                      onClick={() => mitigateThreat(t.id)}
                      style={{ padding: '0.4rem 0.8rem', background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      MITIGAR
                    </button>
                    <button
                      onClick={() => setSelectedThreat(t)}
                      style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      DETALLES
                    </button>
                  </div>
                </article>
              ))}
              {activeThreats.length === 0 && (
                <div style={{ textAlign: 'center', opacity: 0.4, padding: '2rem' }}>No hay amenazas activas. Red segura.</div>
              )}
            </div>

            {/* Historial de mitigadas */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                Historial ({mitigatedThreats.length} mitigadas)
              </div>
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                {mitigatedThreats.slice(0, 10).map(t => (
                  <div key={t.id} className="glass" style={{ minWidth: '200px', padding: '1rem', fontSize: '0.75rem', border: '1px solid var(--accent-green)', opacity: 0.7 }}>
                    <div style={{ fontWeight: 700 }}>{t.type}</div>
                    <div style={{ opacity: 0.6 }}>
                      {t.mitigatedAt ? new Date(t.mitigatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} | NEUTRALIZADO
                    </div>
                    {t.mitigatedBy && <div style={{ opacity: 0.5, marginTop: '0.25rem' }}>Por: {t.mitigatedBy.name}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <button
                className="glass"
                onClick={runDetection}
                disabled={detectionRunning}
                style={{ flex: 1, padding: '1rem', border: '1px dashed var(--accent-green)', color: 'var(--accent-green)', cursor: detectionRunning ? 'wait' : 'pointer', fontWeight: 600 }}
              >
                {detectionRunning ? 'ANALIZANDO RED...' : 'EJECUTAR DETECCIÓN GEO-IP'}
              </button>
              <button
                className="glass"
                onClick={runScan}
                disabled={isScanning}
                style={{ flex: 1, padding: '1rem', border: '1px dashed var(--accent-blue)', color: 'var(--accent-blue)', cursor: isScanning ? 'wait' : 'pointer' }}
              >
                {isScanning ? 'NMAP EN CURSO...' : 'ESCANEO DE RED LOCAL'}
              </button>
            </div>
            {lastDetection && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', opacity: 0.5, display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                <span>Conexiones: {lastDetection.connectionsAnalyzed}</span>
                <span>IPs públicas: {lastDetection.publicIpsFound}</span>
                <span>Duración: {lastDetection.durationMs}ms</span>
                <span>Último: {new Date(lastDetection.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            )}
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <TacticalRadar
              devices={radarDevices}
              threats={activeThreats}
              location={location}
              detectionRunning={detectionRunning}
              maxDistanceKm={maxDistanceKm}
            />

            {/* Log en vivo */}
            <section className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '0.9rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Log del SOC</h2>
              <div role="log" aria-live="polite" style={{ height: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', opacity: i === 0 ? 1 : 0.6, borderLeft: '1px solid var(--border-color)', paddingLeft: '0.5rem' }}>
                    <span style={{ color: l.type === 'alert' ? '#ef4444' : 'var(--accent-blue)', fontWeight: 600 }}>[{l.time}]</span> {l.msg}
                  </div>
                ))}
              </div>
            </section>

            {/* Panel de detalles FLOTANTE */}
            {selectedThreat && (
              <div style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                width: '380px',
                zIndex: 100,
                animation: 'slideIn 0.3s ease-out'
              }}>
                <section className="glass cyber-border" style={{
                  padding: '1.5rem',
                  background: 'rgba(10, 10, 12, 0.95)',
                  border: `1px solid ${severityColor(selectedThreat.severity)}`,
                  boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${severityColor(selectedThreat.severity)}22`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: severityColor(selectedThreat.severity) }}>
                        DETALLES: {selectedThreat.type.toUpperCase()}
                      </h3>
                      <p style={{ fontSize: '0.7rem', opacity: 0.5, fontFamily: 'monospace' }}>ID: {selectedThreat.id}</p>
                    </div>
                    <button
                      onClick={() => setSelectedThreat(null)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px' }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="glass" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.25rem' }}>ORIGEN (IP)</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>{selectedThreat.sourceIp}</div>
                    </div>
                    <div className="glass" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.25rem' }}>DESTINO</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selectedThreat.targetAsset}</div>
                    </div>
                    <div className="glass" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.25rem' }}>SEVERIDAD</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: severityColor(selectedThreat.severity) }}>{selectedThreat.severity.toUpperCase()}</div>
                    </div>
                    <div className="glass" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.25rem' }}>PROTOCOLO</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selectedThreat.protocol || 'TCP'}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '0.5rem' }}>ANÁLISIS DE RIESGO</div>
                    <p style={{ fontSize: '0.8rem', opacity: 0.9, lineHeight: '1.4' }}>
                      {selectedThreat.riskAnalysis || selectedThreat.description}
                    </p>
                  </div>

                  <button
                    onClick={() => { mitigateThreat(selectedThreat.id); setSelectedThreat(null) }}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: severityColor(selectedThreat.severity),
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: `0 4px 12px ${severityColor(selectedThreat.severity)}44`
                    }}
                  >
                    MITIGAR AMENAZA AHORA
                  </button>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ═══════════ ACCESO JIT ═══════════ */}
      {activeTab === 'jit' && (
        <div role="tabpanel" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <section className="glass" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Simulador de Acceso JIT</h2>
            <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Flujo de autorizacion para tareas de mantenimiento de terceros.</p>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={jitStep} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '3rem' }}>
              {[
                { id: 1, label: 'Intento' },
                { id: 2, label: 'Validacion' },
                { id: 3, label: 'Solicitud' },
                { id: 4, label: 'Acceso' },
              ].map(s => (
                <div key={s.id} style={{ textAlign: 'center', opacity: jitStep >= s.id ? 1 : 0.3 }}>
                  <div style={{ width: '40px', height: '40px', background: jitStep >= s.id ? 'var(--accent-blue)' : 'var(--border-color)', borderRadius: '50%', margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.id}</div>
                  <div style={{ fontSize: '0.7rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={runWorkflow}
              style={{ width: '100%', padding: '1rem', background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              {jitStep === 0 ? 'INICIAR FLUJO JIT' : 'SIGUIENTE PASO'}
            </button>
          </section>
          <section className="glass" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Logs de Accion</h2>
            <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {logs.map((l, i) => (
                <div key={i} style={{ fontSize: '0.8rem' }}>
                  <span className="threat-low">[{l.time}]</span> {l.msg}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ═══════════ REPORTES ═══════════ */}
      {activeTab === 'reports' && (
        <section role="tabpanel" className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Generacion de Reportes de Cumplimiento</h2>
          <p style={{ opacity: 0.6, marginBottom: '2rem' }}>Modulo de evidencias automaticas para Auditoria Ley 25.326.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            <button className="glass highlight-on-hover" style={{ padding: '2rem', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', color: 'white' }}>Audit Mensual</button>
            <button className="glass highlight-on-hover" style={{ padding: '2rem', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', color: 'white' }}>Incidente Feb</button>
            <button className="glass highlight-on-hover" style={{ padding: '2rem', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', color: 'white' }}>Health Check</button>
          </div>
        </section>
      )}
    </div>
  )
}
