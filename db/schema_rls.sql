-- Políticas de Row Level Security (RLS) para Petrol-IA

-- 1. Habilitar RLS en las tablas críticas
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE threats ENABLE ROW LEVEL SECURITY;

-- 2. Política para que los contratistas solo vean su propia información
CREATE POLICY contractor_isolation_policy ON contractors
    FOR SELECT
    USING (contractor_id = current_setting('app.current_contractor_id')::uuid);

-- 3. Política para que la Operadora vea todos los contratistas bajo su gestión
CREATE POLICY operator_visibility_policy ON contractors
    FOR SELECT
    USING (operator_id = current_setting('app.current_operator_id')::uuid);

-- 4. Logs de acceso: Solo visibles por el dueño del log o el auditor de la operadora
CREATE POLICY access_logs_policy ON access_logs
    FOR ALL
    USING (
        contractor_id = current_setting('app.current_contractor_id')::uuid
        OR 
        operator_id = current_setting('app.current_operator_id')::uuid
    );
