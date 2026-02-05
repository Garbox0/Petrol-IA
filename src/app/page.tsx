'use client';

import React, { useState, useEffect } from 'react'

export default function Dashboard() {
  const [step, setStep] = useState(0); // 0: Idle, 1: Denied, 2: Fixed, 3: Requested, 4: Active
  const [logs, setLogs] = useState([
    { time: '20:47', msg: 'Sistema SOC Inicializado.', type: 'system' }
  ]);

  const addLog = (msg: string, type: string = 'system') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 5));
  };

  const runWorkflow = () => {
    if (step === 0) {
      setStep(1);
      addLog('Acceso Denegado: PetroServicios S.A. (Score < 70%)', 'alert');
    } else if (step === 1) {
      setStep(2);
      addLog('Parches Aplicados: PetroServicios Score -> 95%', 'system');
    } else if (step === 2) {
      setStep(3);
      addLog('Solicitud JIT Enviada: Acceso a SCADA-04 (2h)', 'system');
    } else if (step === 3) {
      setStep(4);
      addLog('Acceso JIT Aprobado por: Ing. Martínez (Supervisor)', 'system');
    } else {
      setStep(0);
      addLog('Sesión JIT Terminada automáticamente.', 'alert');
    }
  };

  return (
    <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      {/* Header Section */}
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Petrol-IA</h1>
          <p style={{ opacity: 0.6, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            SaaS de Gobernanza de Terceros & Zero Trust
          </p>
        </div>
        <div className="glass" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="status-ring status-online pulse-icon"></span>
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Consola de Licencia: Activa</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>
          <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Operadora: Vaca Muerta North</div>
        </div>
      </header>

      {/* Hero Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass cyber-border" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem', textTransform: 'uppercase' }}>Vendor Health Index</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>94%</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--accent-green)' }}>↑ 2.4% Cumplimiento Global</div>
        </div>

        <div className="glass cyber-border" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem', textTransform: 'uppercase' }}>Licencias Activas JIT</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>{step === 4 ? 13 : 12}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Consumo de cuota: 15%</div>
        </div>

        <div className="glass cyber-border" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem', textTransform: 'uppercase' }}>Acciones Ejecutadas</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>1,242</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Bloqueos automáticos (24h)</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* SOC Console: Real-time Monitor */}
          <section className="glass grid-bg" style={{ padding: '2rem', minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
            <div className="scan-line"></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>SOC Console | Nodo Central Vaca Muerta</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="status-ring status-online pulse-icon" style={{ margin: 0 }}></div>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>MONITOREO DE LICENCIAS ACTIVAS</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>LATENCIA EDGE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-blue)' }}>12ms</div>
                  </div>
                </div>
              </div>

              {/* Traffic Mockup Visual */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100px', marginBottom: '1.5rem' }}>
                {[40, 65, 30, 85, 45, 90, 70, 50, 60, 80, 45, 55, 75, 95, 40, 60, 85, 50, 45, 70, 60, 55, 90, 30, 40, 65].map((h, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: `${h}%`,
                    background: i === 22 ? 'var(--accent-orange)' : 'var(--accent-blue)',
                    opacity: 0.3 + (h / 150),
                    borderRadius: '2px 2px 0 0'
                  }}></div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div className="glass" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.25rem' }}>PROVEEDORES CONECTADOS</div>
                  <div style={{ fontSize: '0.9rem' }}>42</div>
                </div>
                <div className="glass" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.25rem' }}>RECURSOS PROTEGIDOS</div>
                  <div style={{ fontSize: '0.9rem' }}>1,204 PLCs</div>
                </div>
                <div className="glass" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.25rem' }}>LICENCIAS SaaS</div>
                  <div style={{ fontSize: '0.9rem' }}>B2B Enterprise</div>
                </div>
              </div>
            </div>
          </section>

          {/* Market Intelligence / Risk Context */}
          <section className="glass cyber-border" style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 700 }}>Inteligencia de Amenazas (CERT.ar)</h2>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', opacity: 0.9 }}>
              El <strong>Phishing</strong> y <strong>Ransomware</strong> impulsados por IA son los vectores #1. Petrol-IA anula estas amenazas mediante el control de la cadena de suministro y protección de infraestructura crítica.
            </p>
          </section>

          {/* Contratistas Table */}
          <section className="glass" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Estatus de Contratistas (SaaS Governance)</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', opacity: 0.6 }}>
                  <th style={{ paddingBottom: '1rem' }}>PROVEEDOR</th>
                  <th style={{ paddingBottom: '1rem' }}>SCORE DE SALUD</th>
                  <th style={{ paddingBottom: '1rem' }}>LICENCIA</th>
                  <th style={{ paddingBottom: '1rem' }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'TechWell Solutions', risk: 'Bajo', score: '98%', status: 'online' },
                  { name: 'Neuquén Energética S.A.', risk: 'Medio', score: '82%', status: 'warning' },
                  { name: 'Vaca Muerta Logistics', risk: 'Bajo', score: '95%', status: 'online' },
                  { name: 'PetroServicios Global', risk: 'Alto', score: step >= 2 ? '95%' : '64%', status: step >= 2 ? 'online' : 'alert' },
                ].map((vendor, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1.25rem 0', fontWeight: 500 }}>{vendor.name}</td>
                    <td style={{ padding: '1.25rem 0' }}>
                      <span style={{ color: vendor.status === 'alert' ? '#ef4444' : 'var(--accent-green)', fontWeight: 600 }}>{vendor.score}</span>
                    </td>
                    <td style={{ padding: '1.25rem 0', opacity: 0.8 }}>SaaS Basic</td>
                    <td style={{ padding: '1.25rem 0' }}>
                      <span className={`status-ring status-${vendor.status}`}></span>
                      {vendor.status === 'alert' ? 'BLOQUEADO' : 'HABILITADO'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* WORKFLOW SIMULATOR (The Action Side) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="glass cyber-border" style={{ padding: '2rem', borderTop: '2px solid var(--accent-blue)' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Workflow: Solicitud JIT</h2>
            <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '2rem' }}>
              Demostración de cómo Petrol-IA <strong>ejecuta</strong> seguridad en tiempo real.
            </p>

            {/* Stepper Visual */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              {[
                { id: 1, label: 'Intento de Acceso (Técnico)' },
                { id: 2, label: 'Validación de Health-Passport' },
                { id: 3, label: 'Solicitud de Acceso Temporal' },
                { id: 4, label: 'Aprobación y Apertura Túnel' },
              ].map((s) => (
                <div key={s.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  opacity: step >= s.id ? 1 : 0.3,
                  transition: 'opacity 0.3s'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: step >= s.id ? 'var(--accent-blue)' : 'var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>{s.id}</div>
                  <span style={{ fontSize: '0.85rem' }}>{s.label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={runWorkflow}
              style={{
                width: '100%',
                padding: '1rem',
                background: step === 0 || step === 4 ? 'var(--accent-blue)' : 'var(--accent-orange)',
                border: 'none',
                color: 'white',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
                marginBottom: '1rem'
              }}
            >
              {step === 0 ? 'SIMULAR INTENTO DE ACCESO' :
                step === 1 ? 'ESCANEAR Y REPARAR (FIX)' :
                  step === 2 ? 'SOLICITAR JIT (2 HORAS)' :
                    step === 3 ? 'APROBAR (VISTA SUPERVISOR)' : 'CERRAR SESIÓN / FINALIZAR'}
            </button>

            {/* Live Message for the Action */}
            <div className="glass" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', minHeight: '80px' }}>
              <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '0.5rem' }}>ESTADO DEL MOTOR DE ACCIÓN</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                {step === 0 && 'Esperando evento de inicio de sesión...'}
                {step === 1 && 'SISTEMA: Acceso bloqueado. El laptop del técnico no cumple con el nivel de parches.'}
                {step === 2 && 'SISTEMA: Salud validada. El técnico ahora puede pedir su ticket de acceso.'}
                {step === 3 && 'PENDIENTE: El Supervisor ha recibido una notificación push para aprobar.'}
                {step === 4 && 'ÉXITO: Túnel seguro abierto. Sesión grabada iniciada.'}
              </div>
            </div>
          </section>

          {/* Activity Logs (Smaller) */}
          <section className="glass" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.6 }}>LOGS DE AUDITORÍA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {logs.map((log, i) => (
                <div key={i} style={{ fontSize: '0.75rem' }}>
                  <span style={{ color: log.type === 'alert' ? '#ef4444' : 'var(--accent-blue)' }}>[{log.time}]</span> {log.msg}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
