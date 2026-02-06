export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: string;
    contractorId?: string;
    createdAt: string;
    updatedAt: string;
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
