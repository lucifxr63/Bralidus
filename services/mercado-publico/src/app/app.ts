import { Hono } from 'hono';
import { jobsRoutes } from './jobs.routes.js';
import { pingPool } from '../infrastructure/database/client/pg-client.js';
import { env } from './env.js';

/**
 * `mp-sync` — servicio de ingesta de Mercado Público de Bralidus/Animus.
 *
 * Solo extrae y escribe: no sirve producto ni corre análisis LLM. Ver el
 * docblock de `licitus-callback.ts` para el reparto de responsabilidades con
 * Licitus, y el de `pg-client.ts` para el dual-write.
 */
export function createApp() {
  const app = new Hono();

  app.get('/', (c) =>
    c.json({
      service: 'mp-sync',
      description: 'Ingesta de Mercado Público (Bralidus/Animus)',
      endpoints: ['/health', '/jobs/list', '/jobs/run/:job_id', '/jobs/progress', '/jobs/health'],
    }),
  );

  /**
   * Reporta cada destino por separado: uno puede estar mal configurado sin que
   * el otro deje de funcionar, y distinguirlo es justo lo que hace falta al
   * diagnosticar el dual-write.
   */
  app.get('/health', async (c) => {
    const [licitus, bralidus] = await Promise.all([pingPool('licitus'), pingPool('bralidus')]);
    const dualWriteOk = !env.DUAL_WRITE_ENABLED || bralidus.ok;

    return c.json(
      {
        ok: licitus.ok && dualWriteOk,
        service: 'mp-sync',
        dualWriteEnabled: env.DUAL_WRITE_ENABLED,
        databases: { licitus, bralidus },
        callbackConfigured: Boolean(env.LICITUS_CALLBACK_URL),
      },
      licitus.ok && dualWriteOk ? 200 : 503,
    );
  });

  app.route('/jobs', jobsRoutes);

  return app;
}
