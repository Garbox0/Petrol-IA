import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execAsync = promisify(exec);

export async function GET() {
    try {
        // Comando para obtener conexiones TCP activas en Windows
        const { stdout } = await execAsync('powershell "Get-NetTCPConnection -State Established | Select-Object RemoteAddress, RemotePort, LocalPort, State | ConvertTo-Json"');

        let connections = JSON.parse(stdout);

        // Si solo hay una conexión, JSON.parse devuelve un objeto, lo convertimos a array
        if (!Array.isArray(connections)) {
            connections = connections ? [connections] : [];
        }

        // Mapear a un formato más simple para el frontend
        const trafficData = connections.slice(0, 15).map((conn: any) => ({
            remote: conn.RemoteAddress,
            port: conn.RemotePort,
            localPort: conn.LocalPort,
            state: conn.State
        }));

        return NextResponse.json(trafficData);
    } catch (error) {
        console.error('Error fetching network traffic:', error);
        return NextResponse.json({ error: 'Failed to fetch traffic' }, { status: 500 });
    }
}
