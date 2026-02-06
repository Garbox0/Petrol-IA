import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
    const API_KEY = process.env.ABUSE_IPDB_KEY;

    try {
        if (API_KEY) {
            // Intento de conexión con AbuseIPDB (Real)
            const res = await fetch('https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=90', {
                headers: { 'Key': API_KEY, 'Accept': 'application/json' },
                next: { revalidate: 3600 }
            });
            const data = await res.json();

            const feed = data.data.slice(0, 5).map((item: any) => ({
                id: `abuse - ${item.ipAddress} `,
                type: 'Reported Malicious IP',
                source: item.ipAddress,
                severity: 'high',
                target: 'Edge-Firewall',
                description: `Confidence Score: ${item.abuseConfidenceScore}%.Último reporte: ${item.lastReportedAt} `
            }));

            return NextResponse.json({ feed, source: 'AbuseIPDB (Real-time)', updatedAt: new Date().toISOString() });
        }

        // Fallback: Si no hay API KEY, usamos una simulación que avisa al usuario
        // Pero con datos extraídos de un feed público (simulado aquí para el demo)
        const feed = [
            { id: 'public-1', type: 'IOC (Emerging Threats)', source: '45.155.205.233', severity: 'high', target: 'Gateway', description: 'Detectado en lista de IPs comprometidas de ET.' },
            { id: 'public-2', type: 'IOC (Botnet Tracking)', source: '185.224.128.89', severity: 'high', target: 'Plant-Network', description: 'Actividad de C2 reportada recientemente.' },
        ];

        return NextResponse.json({
            feed,
            source: 'Internal (Add ABUSE_IPDB_KEY to .env for Real-time global data)',
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ error: 'Threat Intel Sync failed' }, { status: 500 });
    }
}
