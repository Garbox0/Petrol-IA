import { NextResponse } from 'next/server';
import { jobManager } from '@/lib/jobs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const target = process.env.SCAN_TARGET || '127.0.0.1';

        // En lugar de ejecutar nmap, creamos un Job para que el Conector lo tome
        const job = await jobManager.createJob('network_scan', { target });

        return NextResponse.json({
            message: 'Network scan job created',
            jobId: job.id,
            target,
            status: job.status
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create scan job' }, { status: 500 });
    }
}

// Mantener GET como compatibilidad para ver estado del último job si se desea
export async function GET() {
    const jobs = await jobManager.listJobs();
    const latestScan = jobs.find(j => j.type === 'network_scan');
    return NextResponse.json(latestScan || { message: 'No scans found' });
}
