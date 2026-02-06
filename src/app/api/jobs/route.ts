import { NextResponse } from 'next/server';
import { jobManager } from '@/lib/jobs';

export const runtime = 'nodejs';

// Endpoint para que el Frontend y el Conector interactúen con la cola de trabajos
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');
    const action = searchParams.get('action'); // 'poll' para el conector

    if (action === 'poll') {
        const job = await jobManager.getNextPendingJob();
        if (job) {
            await jobManager.updateJob(job.id, { status: 'running' });
            return NextResponse.json(job);
        }
        return NextResponse.json({ message: 'No pending jobs' }, { status: 204 });
    }

    if (jobId) {
        const job = await jobManager.getJob(jobId);
        return job ? NextResponse.json(job) : NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobs = await jobManager.listJobs();
    return NextResponse.json(jobs);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { jobId, result, status } = body;

        if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

        const updatedJob = await jobManager.updateJob(jobId, {
            status: status || 'completed',
            result
        });

        return updatedJob ? NextResponse.json(updatedJob) : NextResponse.json({ error: 'Job not found' }, { status: 404 });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
