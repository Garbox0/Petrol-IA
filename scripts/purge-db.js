const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'dev.db');
const db = new Database(dbPath);

try {
    db.prepare('DELETE FROM Threat').run();
    db.prepare('DELETE FROM Incident').run();
    db.prepare('DELETE FROM AuditLog').run();
    db.prepare('DELETE FROM Job').run();
    console.log('Base de datos purgada con éxito.');
} catch (e) {
    console.error('Error al purgar:', e);
} finally {
    db.close();
}
