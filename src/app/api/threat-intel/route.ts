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
        return NextResponse.json({
            feed: [],
            source: 'Internal (Add ABUSE_IPDB_KEY for global data)',
            message: 'Waiting for live data feed...',
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ error: 'Threat Intel Sync failed' }, { status: 500 });
    }
}
