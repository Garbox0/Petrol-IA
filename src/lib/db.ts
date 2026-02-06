import Database from 'better-sqlite3';
import path from 'path';

// Determinar la ruta de la base de datos
const dbPath = path.resolve(process.cwd(), 'dev.db');

// Inicializar la base de datos
const db = new Database(dbPath, { verbose: console.log });

// Habilitar claves foráneas
db.pragma('foreign_keys = ON');

// Función para inicializar tablas si no existen (Basado en el esquema de Prisma)
export function initDb() {
  // Tabla Usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT DEFAULT 'operator',
      contractorId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla Contratistas
  db.exec(`
    CREATE TABLE IF NOT EXISTS Contractor (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contactEmail TEXT,
      healthScore INTEGER DEFAULT 50,
      status TEXT DEFAULT 'active',
      riskLevel TEXT DEFAULT 'medium',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla Amenazas
  db.exec(`
    CREATE TABLE IF NOT EXISTS Threat (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT DEFAULT 'analyzing',
      sourceIp TEXT NOT NULL,
      targetAsset TEXT NOT NULL,
      protocol TEXT,
      riskAnalysis TEXT,
      raw TEXT,
      contractorId TEXT,
      mitigatedById TEXT,
      detectedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      mitigatedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contractorId) REFERENCES Contractor(id),
      FOREIGN KEY (mitigatedById) REFERENCES User(id)
    )
  `);

  // Tabla Incidentes
  db.exec(`
    CREATE TABLE IF NOT EXISTS Incident (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      threatId TEXT,
      assignedToId TEXT,
      containedAt DATETIME,
      resolvedAt DATETIME,
      closedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (threatId) REFERENCES Threat(id),
      FOREIGN KEY (assignedToId) REFERENCES User(id)
    )
  `);

  // Tabla Jobs
  db.exec(`
    CREATE TABLE IF NOT EXISTS Job (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payload TEXT NOT NULL,
      result TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla AuditLog
  db.exec(`
    CREATE TABLE IF NOT EXISTS AuditLog (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      details TEXT,
      ipAddress TEXT,
      userId TEXT,
      threatId TEXT,
      incidentId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES User(id),
      FOREIGN KEY (threatId) REFERENCES Threat(id),
      FOREIGN KEY (incidentId) REFERENCES Incident(id)
    )
  `);

  console.log('[DB] Base de datos SQLite (Native) inicializada.');

  // Seed inicial: Administrador (admin123)
  const userCount = db.prepare('SELECT COUNT(*) as count FROM User').get() as any;
  if (userCount.count === 0) {
    const adminId = 'clxp9p0x0000008mi3m6v9z01'; // ID fijo por consistencia
    db.prepare('INSERT INTO User (id, email, name, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(
      adminId,
      'admin@petrol-ia.com',
      'Carlos Mendoza',
      '$2b$10$o/X8NbcRI/lfhdJ6nHB6EOGz7X71g6VA9/3IrQd1LbiOzZBS78xnW', // admin123 (hash real verificado)
      'admin'
    );
    console.log('[DB] Usuario administrador inicial creado.');
  }
}

export default db;
