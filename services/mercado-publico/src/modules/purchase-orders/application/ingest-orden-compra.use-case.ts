import { mercadoPublicoClient } from '../../../infrastructure/mercado-publico/mercado-publico.client';
import { normalizeOrdenCompra } from '../../../infrastructure/mercado-publico/normalizers/orden-compra.normalizer';
import { purchaseOrderRepository } from '../infrastructure/purchase-order.repository';
import { buyerReputationRepository } from '../../buyer-reputation/infrastructure/buyer-reputation.repository';
import type { PurchaseOrder, PurchaseOrderItem } from '../../../shared/types/domain.types';
import { logger } from '../../../infrastructure/logging/logger';

export class IngestOrdenCompraUseCase {
  /** Ingesta desde un raw ya disponible (lista), sin hacer request adicional a MP. */
  async executeFromRaw(raw: import('../../../infrastructure/mercado-publico/mercado-publico.types').MpOrdenCompraRaw): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
    const normalized = normalizeOrdenCompra(raw);
    const order = await purchaseOrderRepository.upsertFromNormalized(normalized);
    if (normalized.buyerOrgCode) {
      buyerReputationRepository
        .recalculateFromPurchaseOrders(normalized.buyerOrgCode)
        .catch((err: unknown) => {
          logger.warn({ err, buyerOrgCode: normalized.buyerOrgCode }, 'Failed to recalculate buyer reputation');
        });
    }
    return order;
  }

  /**
   * `shouldAbort` deja que el caller corte los reintentos cuando se le acaba el
   * presupuesto de tiempo. `ingest-licitacion.use-case` ya lo propagaba; acá
   * faltaba, y esa asimetría es la que producía las corridas huérfanas de
   * `enrich-ordenes` (ver la nota en `getOrdenCompraByCodigo`).
   */
  async execute(
    codigo: string,
    shouldAbort?: () => boolean,
  ): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
    logger.info({ codigo }, 'Ingesting orden de compra from Mercado Público');

    const raw = await mercadoPublicoClient.getOrdenCompraByCodigo(codigo, shouldAbort);
    const normalized = normalizeOrdenCompra(raw);
    const order = await purchaseOrderRepository.upsertFromNormalized(normalized);

    // Fire-and-forget: recalcular reputación del organismo comprador
    if (normalized.buyerOrgCode) {
      buyerReputationRepository
        .recalculateFromPurchaseOrders(normalized.buyerOrgCode)
        .catch((err: unknown) => {
          logger.warn(
            { err, buyerOrgCode: normalized.buyerOrgCode },
            'Failed to recalculate buyer reputation',
          );
        });
    }

    logger.info({ codigo, id: order.id }, 'Orden de compra ingested');
    return order;
  }
}

export const ingestOrdenCompraUseCase = new IngestOrdenCompraUseCase();
