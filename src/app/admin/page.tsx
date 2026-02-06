'use client'

import { useState } from 'react'

interface OrgMock {
    id: string
    name: string
    plan: string
    status: 'active' | 'pending' | 'suspended'
    deployments: number
    users: number
    token?: string
}

export default function AdminDashboard() {
    const [showNewOrg, setShowNewOrg] = useState(false)
    const [selectedOrg, setSelectedOrg] = useState<OrgMock | null>(null)

    const [orgs, setOrgs] = useState<OrgMock[]>([
        { id: 'org_8j29', name: 'YPF Vaca Muerta', plan: 'Enterprise', status: 'active', deployments: 12, users: 45 },
        { id: 'org_9k31', name: 'Tecpetrol Fortín', plan: 'Pro', status: 'active', deployments: 3, users: 8 },
        { id: 'org_2l11', name: 'Vista Oil & Gas', plan: 'Pro', status: 'pending', deployments: 0, users: 1 }
    ])

    const [generatedToken, setGeneratedToken] = useState<string | null>(null)

    const handleGenerateToken = (org: OrgMock) => {
        // Simular generación de token criptográfico
        const token = `pia_${org.id.split('_')[1]}_${Math.random().toString(36).substring(2, 10)}`
        setGeneratedToken(token)
        setSelectedOrg(org)
    }

    const copyCommand = () => {
        const cmd = `curl -sL https://petrol.ia/install | bash -s -- --token ${generatedToken}`
        navigator.clipboard.writeText(cmd)
        alert('Comando copiado al portapapeles')
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#10b981] selection:text-black">
            {/* Admin Navbar */}
            <nav className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-tr from-[#10b981] to-[#059669] rounded-lg flex items-center justify-center font-bold text-black border border-[#34d399]">
                            P
                        </div>
                        <div>
                            <div className="font-bold text-lg tracking-tight">Petrol-IA <span className="text-[#10b981]">Vendor</span></div>
                            <div className="text-[0.65rem] uppercase tracking-widest opacity-50">Super Admin Console</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="opacity-60 hover:opacity-100 cursor-pointer transition-opacity">Documentación</div>
                        <div className="opacity-60 hover:opacity-100 cursor-pointer transition-opacity">Soporte</div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono">AD</div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-12">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="text-sm opacity-50 uppercase tracking-wider mb-2">Total ARR</div>
                        <div className="text-3xl font-bold font-mono">$1.2M</div>
                        <div className="text-xs text-[#10b981] mt-2 flex items-center gap-1">▲ 12% vs last month</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="text-sm opacity-50 uppercase tracking-wider mb-2">Active Tenants</div>
                        <div className="text-3xl font-bold font-mono">24</div>
                        <div className="text-xs text-[#10b981] mt-2 flex items-center gap-1">▲ 2 new this week</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="text-sm opacity-50 uppercase tracking-wider mb-2">Total Agents</div>
                        <div className="text-3xl font-bold font-mono">158</div>
                        <div className="text-xs text-orange-400 mt-2 flex items-center gap-1">● 98.5% uptime</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="text-sm opacity-50 uppercase tracking-wider mb-2">Pending Setup</div>
                        <div className="text-3xl font-bold font-mono">3</div>
                        <div className="text-xs opacity-50 mt-2">Needs attention</div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Organizaciones</h2>
                    <button
                        onClick={() => setShowNewOrg(true)}
                        className="bg-[#10b981] hover:bg-[#059669] text-black px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
                    >
                        <span>+</span> Nueva Organización
                    </button>
                </div>

                {/* Tenants Table */}
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase tracking-wider font-semibold opacity-70">
                            <tr>
                                <th className="px-6 py-4">Organización</th>
                                <th className="px-6 py-4">Plan</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Deployments</th>
                                {/* <th className="px-6 py-4 text-center">Usuarios</th> */}
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {orgs.map((org) => (
                                <tr key={org.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-base mb-1">{org.name}</div>
                                        <div className="font-mono text-xs opacity-50">{org.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${org.plan === 'Enterprise' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            }`}>
                                            {org.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${org.status === 'active' ? 'bg-[#10b981] shadow-[0_0_8px_#10b981]' :
                                                    org.status === 'pending' ? 'bg-orange-400' : 'bg-red-500'
                                                }`} />
                                            <span className="capitalize opacity-80">{org.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono opacity-80">{org.deployments}</td>
                                    {/* <td className="px-6 py-4 text-center font-mono opacity-80">{org.users}</td> */}
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleGenerateToken(org)}
                                            className="text-[#10b981] hover:bg-[#10b981]/10 px-3 py-1.5 rounded border border-[#10b981]/30 text-xs font-mono transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            GENERAR TOKEN
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {orgs.length === 0 && (
                        <div className="p-12 text-center opacity-50">No hay organizaciones registradas.</div>
                    )}
                </div>
            </main>

            {/* New Org Modal */}
            {showNewOrg && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4">Nueva Organización</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase opacity-50 mb-1">Nombre Comercial</label>
                                <input type="text" className="w-full bg-white/5 border border-white/10 rounded p-2 text-white focus:border-[#10b981] outline-none transition-colors" placeholder="Ej: Pluspetrol Norte" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase opacity-50 mb-1">Plan de Suscripción</label>
                                <select className="w-full bg-white/5 border border-white/10 rounded p-2 text-white focus:border-[#10b981] outline-none transition-colors">
                                    <option>Starter (Up to 5 nodes)</option>
                                    <option>Pro (Up to 50 nodes)</option>
                                    <option>Enterprise (Unlimited)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setShowNewOrg(false)}
                                className="px-4 py-2 rounded text-sm hover:bg-white/10 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setOrgs([...orgs, { id: `org_${Math.random().toString(36).substr(2, 4)}`, name: 'Nueva S.A.', plan: 'Pro', status: 'pending', deployments: 0, users: 0 }])
                                    setShowNewOrg(false)
                                }}
                                className="px-4 py-2 rounded text-sm bg-[#10b981] text-black font-semibold hover:bg-[#059669] transition-colors"
                            >
                                Crear Tenant
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enrollment Token Logic Overlay */}
            {generatedToken && selectedOrg && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0f1210] border border-[#10b981] rounded-2xl w-full max-w-2xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
                        {/* Background cyber decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#10b981] opacity-5 blur-[80px] pointer-events-none"></div>

                        <button
                            onClick={() => setGeneratedToken(null)}
                            className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-[#10b981]/20 flex items-center justify-center text-[#10b981]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Token de Instalación Generado</h3>
                                <div className="text-sm text-[#10b981] opacity-80">Para: {selectedOrg.name}</div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-black/40 border border-[#10b981]/30 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs uppercase tracking-widest text-[#10b981] font-bold">Enrollment Key</label>
                                    <span className="text-xs text-orange-400 font-mono">Expires in 24h</span>
                                </div>
                                <div className="font-mono text-lg tracking-wider select-all cursor-text bg-black/20 p-2 rounded border border-white/5">
                                    {generatedToken}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs uppercase opacity-50 mb-3">Comando de Instalación (One-Line)</label>
                                <div className="bg-[#050505] border border-white/10 rounded-lg p-4 font-mono text-sm relative group">
                                    <div className="text-gray-400 select-all">
                                        <span className="text-purple-400">curl</span> -sL https://petrol.ia/install | <span className="text-yellow-400">bash</span> -s -- --token <span className="text-[#10b981] font-bold">{generatedToken}</span>
                                    </div>
                                    <button
                                        onClick={copyCommand}
                                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded transition-colors"
                                    >
                                        Copiar
                                    </button>
                                </div>
                                <p className="text-xs opacity-40 mt-3 pl-1">
                                    * Este script descargará el agente, verificará la firma digital y registrará el nodo automáticamente en el dashboard de <strong>{selectedOrg.name}</strong>.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 flex gap-4">
                            <button
                                onClick={() => setGeneratedToken(null)}
                                className="flex-1 bg-[#10b981] text-black font-bold py-3 rounded-lg hover:bg-[#059669] transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                            >
                                Listo, enviar al cliente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
