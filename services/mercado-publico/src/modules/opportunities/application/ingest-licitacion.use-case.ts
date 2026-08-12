import { mercadoPublicoClient } from '../../../infrastructure/mercado-publico/mercado-publico.client';
import { fetchEnlaceAnexos } from '../../../infrastructure/mercado-publico/ocds.client';
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

    // La API v1 no expone adjuntos de licitación en ninguna de sus fichas, pero
    // OCDS sí publica un enlace a la página donde están listados. Es lo único
    // que hay para el hueco más grande del expediente, así que se agrega.
    //
    // Sólo en adjudicadas (statusCode 8): en las demás el release de OCDS viene
    // vacío y la llamada sería a pérdida. Son ~5.850 de 15.695 licitaciones.
    // `fetchEnlaceAnexos` nunca lanza — un enlace de más no puede tumbar una
    // ingesta que ya trajo la ficha completa.
    const anexos = await fetchEnlaceAnexos(codigo, {
      adjudicada: normalized.statusCode === 8,
    });
    normalized.attachments = anexos.anexos;

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
