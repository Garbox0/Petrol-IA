/**
 * Petrol-IA Connector Simulator (v1)
 * 
 * Este script simula el agente que corre en la red del cliente.
 * 1. Hace polling al Hub para buscar trabajos.
 * 2. Ejecuta nmap localmente.
 * 3. Reporta resultados.
 */

const HUB_URL = 'http://localhost:3000/api/jobs';

async function main() {
    console.log('--- Petrol-IA Connector Simulator v1 ---');
    console.log(`Conectando con Hub en: ${HUB_URL}`);

    while (true) {
        try {
            // 1. Polling (buscar trabajos)
            const res = await fetch(`${HUB_URL}?action=poll`);

            if (res.status === 200) {
                const job = await res.json();
                console.log(`\n[Job Recibido] ID: ${job.id} | Tipo: ${job.type}`);

                if (job.type === 'network_scan') {
                    console.log(`Ejecutando escaneo real sobre: ${job.payload.target}...`);

                    // Importar node modules solo si es necesario (el entorno tiene node)
                    const { execSync } = require('child_process');

                    try {
                        // Ejecutar nmap real (PING SCAN)
                        const stdout = execSync(`nmap -sn ${job.payload.target}`).toString();

                        const hosts = stdout.split('\n')
                            .filter(line => line.includes('Nmap scan report for'))
                            .map(line => line.replace('Nmap scan report for ', '').trim());

                        console.log(`Escaneo completado. ${hosts.length} hosts vivos encontrados.`);

                        // 3. Reportar resultados al Hub
                        await fetch(HUB_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jobId: job.id,
                                status: 'completed',
                                result: { hosts, raw: stdout }
                            })
                        });
                        console.log(`[Job ${job.id}] Reportado exitosamente.`);

                    } catch (scanError) {
                        console.error('Error durante el escaneo:', scanError.message);
                        await fetch(HUB_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jobId: job.id, status: 'failed', result: { error: scanError.message } })
                        });
                    }
                }
            } else {
                // No hay trabajos, esperar un poco
                process.stdout.write('.');
            }
        } catch (e) {
            console.error('\nError de conexión con el Hub. Reintentando en 5s...');
        }

        // Esperar 5 segundos para el siguiente poll
        await new Promise(r => setTimeout(r, 5000));
    }
}

main();
