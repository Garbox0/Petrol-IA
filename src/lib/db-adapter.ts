import db, { initDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import { User, Contractor, Threat, Incident, Job, AuditLog } from './types';

// Inicializar tablas al cargar el módulo
initDb();

/**
 * Helper para procesar valores antes de insertarlos/actualizarlos en SQLite.
 * Convierte objetos Date a strings ISO.
 */
function prepareValue(value: any): any {
    if (value instanceof Date) return value.toISOString();
    return value;
}

/**
 * Adaptador de compatibilidad minimalista "Prisma-like" para no romper las APIs actuales.
 * Esto usa better-sqlite3 por debajo, eliminando los motores de Prisma.
 * Todos los métodos son asíncronos para mantener la consistencia con el ecosistema.
 */
export const prisma = {
    user: {
        findUnique: async ({ where, include, select }: { where: { email?: string; id?: string }, include?: any, select?: any }): Promise<User | null> => {
            try {
                const stmt = db.prepare('SELECT * FROM User WHERE email = ? OR id = ?');
                const user = stmt.get(where.email || null, where.id || null) as User | undefined;
                return user || null;
            } catch (error) {
                console.error('[DB] user.findUnique error:', error);
                throw error;
            }
        },
        create: async ({ data, include, select }: { data: Partial<User>, include?: any, select?: any }): Promise<User> => {
            try {
                const id = data.id || uuidv4();
                const stmt = db.prepare('INSERT INTO User (id, email, name, passwordHash, role, contractorId) VALUES (?, ?, ?, ?, ?, ?)');
                stmt.run(id, data.email, prepareValue(data.name), data.passwordHash, data.role || 'operator', data.contractorId);
                return { id, email: data.email!, name: data.name!, passwordHash: data.passwordHash!, role: data.role || 'operator', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as User;
            } catch (error) {
                console.error('[DB] user.create error:', error);
                throw error;
            }
        }
    },
    contractor: {
        findMany: async (args?: any): Promise<(Contractor & { _count: any })[]> => {
            try {
                const stmt = db.prepare('SELECT * FROM Contractor ORDER BY name ASC');
                const contractors = stmt.all() as Contractor[];
                return contractors.map((c: Contractor) => ({
                    ...c,
                    _count: {
                        users: (db.prepare('SELECT COUNT(*) as count FROM User WHERE contractorId = ?').get(c.id) as any).count,
                        threats: (db.prepare('SELECT COUNT(*) as count FROM Threat WHERE contractorId = ?').get(c.id) as any).count,
                        accessRequests: 0
                    }
                }));
            } catch (error) {
                console.error('[DB] contractor.findMany error:', error);
                throw error;
            }
        },
        update: async ({ where, data, include, select }: { where: { id: string }; data: Partial<Contractor>, include?: any, select?: any }): Promise<Contractor> => {
            try {
                const sets = [];
                const params = [];
                for (const [key, value] of Object.entries(data)) {
                    if (key === 'id') continue;
                    sets.push(`${key} = ?`);
                    params.push(prepareValue(value));
                }
                params.push(where.id);
                db.prepare(`UPDATE Contractor SET ${sets.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
                return db.prepare('SELECT * FROM Contractor WHERE id = ?').get(where.id) as Contractor;
            } catch (error) {
                console.error('[DB] contractor.update error:', error);
                throw error;
            }
        }
    },
    threat: {
        findMany: async ({ where, take, orderBy, include, select }: any = {}): Promise<(Threat & { contractor?: any; mitigatedBy?: any })[]> => {
            try {
                let query = 'SELECT * FROM Threat';
                const params = [];
                if (where?.status) {
                    query += ' WHERE status = ?';
                    params.push(where.status);
                }
                query += ' ORDER BY detectedAt DESC';
                if (take) {
                    query += ' LIMIT ?';
                    params.push(take);
                }
                const threats = db.prepare(query).all(...params) as Threat[];
                return threats.map(t => ({
                    ...t,
                    contractor: t.contractorId ? db.prepare('SELECT id, name FROM Contractor WHERE id = ?').get(t.contractorId) : null,
                    mitigatedBy: t.mitigatedById ? db.prepare('SELECT id, name FROM User WHERE id = ?').get(t.mitigatedById) : null
                }));
            } catch (error) {
                console.error('[DB] threat.findMany error:', error);
                throw error;
            }
        },
        findUnique: async ({ where, include, select }: { where: { id: string }; include?: any, select?: any }): Promise<(Threat & { contractor?: any; mitigatedBy?: any; incidents?: any; auditLogs?: any }) | null> => {
            try {
                const threat = db.prepare('SELECT * FROM Threat WHERE id = ?').get(where.id) as Threat | undefined;
                if (!threat) return null;
                return {
                    ...threat,
                    contractor: threat.contractorId ? db.prepare('SELECT id, name FROM Contractor WHERE id = ?').get(threat.contractorId) : null,
                    mitigatedBy: threat.mitigatedById ? db.prepare('SELECT id, name FROM User WHERE id = ?').get(threat.mitigatedById) : null,
                    incidents: db.prepare('SELECT * FROM Incident WHERE threatId = ?').all(where.id),
                    auditLogs: db.prepare('SELECT * FROM AuditLog WHERE threatId = ? ORDER BY createdAt DESC LIMIT 20').all(where.id)
                };
            } catch (error) {
                console.error('[DB] threat.findUnique error:', error);
                throw error;
            }
        },
        count: async ({ where, include, select }: any = {}): Promise<number> => {
            try {
                let query = 'SELECT COUNT(*) as count FROM Threat';
                const params = [];
                if (where?.status?.notIn) {
                    const placeholders = where.status.notIn.map(() => '?').join(',');
                    query += ` WHERE status NOT IN (${placeholders})`;
                    params.push(...where.status.notIn);
                }
                return (db.prepare(query).get(...params) as any).count;
            } catch (error) {
                console.error('[DB] threat.count error:', error);
                throw error;
            }
        },
        create: async ({ data, include, select }: { data: Partial<Threat>, include?: any, select?: any }): Promise<Threat> => {
            try {
                const id = uuidv4();
                const stmt = db.prepare('INSERT INTO Threat (id, type, description, severity, status, sourceIp, targetAsset, protocol, riskAnalysis, raw, contractorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                stmt.run(id, data.type, data.description, data.severity, data.status || 'analyzing', data.sourceIp, data.targetAsset, data.protocol, data.riskAnalysis, data.raw, data.contractorId);
                // Return with relations if requested (simplified as our findUnique does it)
                const result = await prisma.threat.findUnique({ where: { id }, include });
                return result as any;
            } catch (error) {
                console.error('[DB] threat.create error:', error);
                throw error;
            }
        },
        update: async ({ where, data, include, select }: { where: { id: string }; data: Partial<Threat>, include?: any, select?: any }): Promise<Threat> => {
            try {
                const sets = [];
                const params = [];
                for (const [key, value] of Object.entries(data)) {
                    if (key === 'id') continue;
                    sets.push(`${key} = ?`);
                    params.push(prepareValue(value));
                }
                params.push(where.id);
                if (sets.length > 0) {
                    db.prepare(`UPDATE Threat SET ${sets.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
                }
                // Return with relations if requested (simplified as our findUnique does it)
                const result = await prisma.threat.findUnique({ where: { id: where.id }, include });
                return result as any;
            } catch (error) {
                console.error('[DB] threat.update error:', error);
                throw error;
            }
        }
    },
    incident: {
        findMany: async ({ where, take, include, select }: any = {}): Promise<(Incident & { threat?: any; assignedTo?: any })[]> => {
            try {
                let query = 'SELECT * FROM Incident';
                const params = [];
                if (where?.status) {
                    query += ' WHERE status = ?';
                    params.push(where.status);
                }
                query += ' ORDER BY createdAt DESC';
                if (take) {
                    query += ' LIMIT ?';
                    params.push(take);
                }
                const incidents = db.prepare(query).all(...params) as Incident[];
                return incidents.map(i => ({
                    ...i,
                    threat: i.threatId ? db.prepare('SELECT id, type, severity, sourceIp FROM Threat WHERE id = ?').get(i.threatId) : null,
                    assignedTo: i.assignedToId ? db.prepare('SELECT id, name FROM User WHERE id = ?').get(i.assignedToId) : null
                }));
            } catch (error) {
                console.error('[DB] incident.findMany error:', error);
                throw error;
            }
        },
        findUnique: async ({ where, include, select }: { where: { id: string }; include?: any, select?: any }): Promise<(Incident & { threat?: any; assignedTo?: any; auditLogs?: any }) | null> => {
            try {
                const incident = db.prepare('SELECT * FROM Incident WHERE id = ?').get(where.id) as Incident | undefined;
                if (!incident) return null;
                return {
                    ...incident,
                    threat: incident.threatId ? db.prepare('SELECT * FROM Threat WHERE id = ?').get(incident.threatId) : null,
                    assignedTo: incident.assignedToId ? db.prepare('SELECT id, name, email FROM User WHERE id = ?').get(incident.assignedToId) : null,
                    auditLogs: db.prepare('SELECT * FROM AuditLog WHERE incidentId = ? ORDER BY createdAt DESC LIMIT 30').all(where.id)
                };
            } catch (error) {
                console.error('[DB] incident.findUnique error:', error);
                throw error;
            }
        },
        count: async ({ where, include, select }: any = {}): Promise<number> => {
            try {
                let query = 'SELECT COUNT(*) as count FROM Incident';
                const params = [];
                if (where?.status?.notIn) {
                    const placeholders = where.status.notIn.map(() => '?').join(',');
                    query += ` WHERE status NOT IN (${placeholders})`;
                    params.push(...where.status.notIn);
                }
                return (db.prepare(query).get(...params) as any).count;
            } catch (error) {
                console.error('[DB] incident.count error:', error);
                throw error;
            }
        },
        create: async ({ data, include, select }: { data: Partial<Incident>, include?: any, select?: any }): Promise<Incident> => {
            try {
                const id = uuidv4();
                const stmt = db.prepare('INSERT INTO Incident (id, title, description, severity, status, threatId, assignedToId) VALUES (?, ?, ?, ?, ?, ?, ?)');
                stmt.run(id, data.title, data.description, data.severity, data.status || 'open', data.threatId, data.assignedToId);
                const result = await prisma.incident.findUnique({ where: { id }, include });
                return result as any;
            } catch (error) {
                console.error('[DB] incident.create error:', error);
                throw error;
            }
        },
        update: async ({ where, data, include, select }: { where: { id: string }; data: Partial<Incident>, include?: any, select?: any }): Promise<Incident> => {
            try {
                const sets = [];
                const params = [];
                for (const [key, value] of Object.entries(data)) {
                    if (key === 'id') continue;
                    sets.push(`${key} = ?`);
                    params.push(prepareValue(value));
                }
                params.push(where.id);
                if (sets.length > 0) {
                    db.prepare(`UPDATE Incident SET ${sets.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
                }
                const result = await prisma.incident.findUnique({ where: { id: where.id }, include });
                return result as any;
            } catch (error) {
                console.error('[DB] incident.update error:', error);
                throw error;
            }
        }
    },
    job: {
        findMany: async (args?: any): Promise<Job[]> => {
            try {
                return db.prepare('SELECT * FROM Job ORDER BY createdAt DESC').all() as Job[];
            } catch (error) {
                console.error('[DB] job.findMany error:', error);
                throw error;
            }
        },
        findUnique: async ({ where, include, select }: any): Promise<Job | null> => {
            try {
                return (db.prepare('SELECT * FROM Job WHERE id = ?').get(where.id) as Job) || null;
            } catch (error) {
                console.error('[DB] job.findUnique error:', error);
                throw error;
            }
        },
        findFirst: async ({ where, orderBy, include, select }: any): Promise<Job | null> => {
            try {
                if (where?.status) {
                    return (db.prepare('SELECT * FROM Job WHERE status = ? ORDER BY createdAt ASC LIMIT 1').get(where.status) as Job) || null;
                }
                return (db.prepare('SELECT * FROM Job LIMIT 1').get() as Job) || null;
            } catch (error) {
                console.error('[DB] job.findFirst error:', error);
                throw error;
            }
        },
        create: async ({ data }: { data: Partial<Job> }): Promise<Job> => {
            try {
                const id = uuidv4();
                const stmt = db.prepare('INSERT INTO Job (id, type, status, payload) VALUES (?, ?, ?, ?)');
                stmt.run(id, data.type, data.status || 'pending', data.payload);
                return db.prepare('SELECT * FROM Job WHERE id = ?').get(id) as Job;
            } catch (error) {
                console.error('[DB] job.create error:', error);
                throw error;
            }
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Job> }): Promise<Job> => {
            try {
                const sets = [];
                const params = [];
                for (const [key, value] of Object.entries(data)) {
                    if (key === 'id') continue;
                    sets.push(`${key} = ?`);
                    params.push(prepareValue(value));
                }
                params.push(where.id);
                if (sets.length > 0) {
                    db.prepare(`UPDATE Job SET ${sets.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
                }
                return db.prepare('SELECT * FROM Job WHERE id = ?').get(where.id) as Job;
            } catch (error) {
                console.error('[DB] job.update error:', error);
                throw error;
            }
        },
        deleteMany: async () => {
            try {
                db.prepare('DELETE FROM Job').run();
                return { count: 0 };
            } catch (error) {
                console.error('[DB] job.deleteMany error:', error);
                throw error;
            }
        }
    },
    auditLog: {
        create: async ({ data }: { data: Partial<AuditLog> }): Promise<AuditLog> => {
            try {
                const id = uuidv4();
                const stmt = db.prepare('INSERT INTO AuditLog (id, action, entityType, entityId, details, userId, threatId, incidentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                stmt.run(id, data.action, data.entityType, data.entityId, data.details, data.userId, data.threatId, data.incidentId);
                return db.prepare('SELECT * FROM AuditLog WHERE id = ?').get(id) as AuditLog;
            } catch (error) {
                console.error('[DB] auditLog.create error:', error);
                throw error;
            }
        },
        findMany: async ({ orderBy, take, include }: any = {}): Promise<(AuditLog & { user?: any })[]> => {
            try {
                const logs = db.prepare('SELECT * FROM AuditLog ORDER BY createdAt DESC LIMIT ?').all(take || 10) as AuditLog[];
                return logs.map(l => ({
                    ...l,
                    user: l.userId ? db.prepare('SELECT name FROM User WHERE id = ?').get(l.userId) : null
                }));
            } catch (error) {
                console.error('[DB] auditLog.findMany error:', error);
                throw error;
            }
        }
    }
};
