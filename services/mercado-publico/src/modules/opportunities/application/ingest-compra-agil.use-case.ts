import { compraAgilClient } from '../../../infrastructure/mercado-publico/compra-agil.client';
import { normalizeCompraAgil } from '../../../infrastructure/mercado-publico/normalizers/compra-agil.normalizer';
import type { CompraAgilListItem } from '../../../infrastructure/mercado-publico/compra-agil.types';
import { opportunityRepository } from '../infrastructure/opportunity.repository';
import { canonicalRepository } from '../../canonical/canonical.repository';
import type { OpportunityWithItems } from '../../../shared/types/domain.types';
import { logger } from '../../../infrastructure/logging/logger';

export class IngestCompraAgilUseCase {
  /**
   * A diferencia de las licitaciones, el listado de Compra Ágil ya trae casi
   * todo lo persistible; el detalle se pide por los `productos_solicitados`
   * (UNSPSC) y la descripción, que el matching necesita. `skipDetalle` existe
   * para corridas de conteo/diagnóstico donde no vale la pena pagar 1 request
   * por proceso.
   */
  async execute(
    item: CompraAgilListItem,
    options: { skipDetalle?: boolean } = {},
  ): Promise<OpportunityWithItems> {
    const detalle = options.skipDetalle ? null : await compraAgilClient.getByCodigo(item.codigo);
    const normalized = normalizeCompraAgil(item, detalle);
    const opportunity = await opportunityRepository.upsertFromNormalized(normalized);

    // Dual-write al destino canónico (ver nota en ingest-licitacion.use-case).
    await canonicalRepository.upsertOne(normalized);

    logger.info(
      { codigo: item.codigo, id: opportunity.id, itemCount: opportunity.items.length },
      'Compra Ágil ingested successfully',
    );

    return opportunity;
  }
}

export const ingestCompraAgilUseCase = new IngestCompraAgilUseCase();
