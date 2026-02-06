export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: string;
    contractorId?: string;
    organizationId?: string; // Multi-tenancy support
    createdAt: string;
    updatedAt: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string; // para URLs amigables
    plan: 'starter' | 'pro' | 'enterprise';
    status: 'active' | 'suspended';
    contactEmail: string;
    createdAt: string;
    licenseKey?: string;
}

export interface EnrollmentToken {
    id: string;
    token: string;
    organizationId: string;
    organizationName?: string; // Helper para UI
    expiresAt: string;
    createdBy: string;
    usedCount: number;
    maxUses: number;
}

export interface Contractor {
    id: string;
    name: string;
    contactEmail?: string;
    healthScore: number;
    status: string;
    riskLevel: string;
    createdAt: string;
    updatedAt: string;
}

export interface Threat {
    id: string;
    type: string;
    description: string;
    severity: string;
    status: string;
    sourceIp: string;
    targetAsset: string;
    protocol?: string;
    riskAnalysis?: string;
    raw?: string;
    contractorId?: string;
    mitigatedById?: string;
    detectedAt: string;
    mitigatedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Incident {
    id: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    threatId?: string;
    assignedToId?: string;
    containedAt?: string;
    resolvedAt?: string;
    closedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Job {
    id: string;
    type: string;
    status: string;
    payload: string;
    result?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: string;
    ipAddress?: string;
    userId?: string;
    threatId?: string;
    incidentId?: string;
    createdAt: string;
}
