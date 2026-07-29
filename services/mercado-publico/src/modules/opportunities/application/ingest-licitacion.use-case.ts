import { mercadoPublicoClient } from '../../../infrastructure/mercado-publico/mercado-publico.client';
import { normalizeLicitacion } from '../../../infrastructure/mercado-publico/normalizers/licitacion.normalizer';
import { opportunityRepository } from '../infrastructure/opportunity.repository';
import { canonicalRepository } from '../../canonical/canonical.repository';
import type { OpportunityWithItems } from '../../../shared/types/domain.types';
import { logger } from '../../../infrastructure/logging/logger';

export class IngestLicitacionUseCase {
  async execute(codigo: string, shouldAbort?: () => boolean): Promise<OpportunityWithItems> {
    logger.info({ codigo }, 'Ingesting licitación from Mercado Público');

    const raw = await mercadoPublicoClient.getLicitacionByCodigo(codigo, shouldAbort);
    const normalized = normalizeLicitacion(raw);
    const opportunity = await opportunityRepository.upsertFromNormalized(normalized);

    // Dual-write al destino canónico de Bralidus/Animus. Va DESPUÉS del write a
    // Licitus y nunca lanza: si el segundo destino falla, la ingesta que
    // alimenta el producto ya quedó firme.
    await canonicalRepository.upsertOne(normalized);

    logger.info(
      { codigo, id: opportunity.id, itemCount: opportunity.items.length },
      'Licitación ingested successfully',
    );

    return opportunity;
  }
}

export const ingestLicitacionUseCase = new IngestLicitacionUseCase();
