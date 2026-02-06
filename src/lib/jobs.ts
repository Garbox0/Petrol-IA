import { prisma } from './prisma';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
    id: string;
    type: string;
    status: JobStatus;
    payload: any;
    result?: any;
    createdAt: string;
    updatedAt: string;
}

class JobManager {
    async createJob(type: string, payload: any): Promise<any> {
        return prisma.job.create({
            data: {
                type,
                status: 'pending',
                payload: JSON.stringify(payload),
            }
        });
    }

    async getJob(id: string): Promise<any> {
        const job = await prisma.job.findUnique({ where: { id } });
        if (job) {
            return {
                ...job,
                payload: JSON.parse(job.payload),
                result: job.result ? JSON.parse(job.result) : undefined
            };
        }
        return undefined;
    }

    async updateJob(id: string, updates: any): Promise<any> {
        const data: any = { ...updates };
        if (updates.payload) data.payload = JSON.stringify(updates.payload);
        if (updates.result) data.result = JSON.stringify(updates.result);

        return prisma.job.update({
            where: { id },
            data
        });
    }

    async listJobs(): Promise<any[]> {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return jobs.map(j => ({
            ...j,
            payload: JSON.parse(j.payload),
            result: j.result ? JSON.parse(j.result) : undefined
        }));
    }

    async getNextPendingJob(): Promise<any> {
        const job = await prisma.job.findFirst({
            where: { status: 'pending' },
            orderBy: { createdAt: 'asc' }
        });
        if (job) {
            return {
                ...job,
                payload: JSON.parse(job.payload),
                result: job.result ? JSON.parse(job.result) : undefined
            };
        }
        return undefined;
    }
}

export const jobManager = new JobManager();
