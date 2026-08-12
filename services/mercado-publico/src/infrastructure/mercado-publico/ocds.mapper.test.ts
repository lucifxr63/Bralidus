import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapDocumentosOcds } from './ocds.mapper.ts';

/**
 * Corre con el runner nativo: `npm test`.
 *
 * Lo que se fija acá es el rótulo, no el transporte. El riesgo de esta
 * integración no es que falle la llamada —está en try/catch y es aditiva— sino
 * que un enlace a una PÁGINA detrás de reCAPTCHA se publique como si fuera un
 * archivo descargable. Eso es lo que el integrador consumiría creyendo tener
 * las bases.
 */

const URL_A = 'http://www.mercadopublico.cl/Procurement/Modules/Attachment/ViewAttachment.aspx?enc=AAA';
const URL_B = 'http://www.mercadopublico.cl/Procurement/Modules/Attachment/ViewAttachment.aspx?enc=BBB';

test('un documento OCDS se rotula como página NO descargable', () => {
  const [doc] = mapDocumentosOcds(
    [{ id: '1', documentType: 'awardNotice', title: 'Página documentos', url: URL_A, format: 'text/html' }],
    '2026-08-11T22:00:00.000Z',
  );

  assert.equal(doc.tipo, 'pagina');
  assert.equal(doc.origen, 'ocds_award');
  assert.equal(doc.descargable, false, 'NUNCA true: detrás hay un reCAPTCHA Enterprise');
  assert.equal(doc.url, URL_A);
  assert.equal(doc.obtenido_at, '2026-08-11T22:00:00.000Z');
});

test('el mismo enlace repetido en varias adjudicaciones se guarda una vez', () => {
  // El `enc` apunta al proceso, no al lote: un proceso con 3 adjudicaciones
  // trae 3 veces la misma URL.
  const docs = mapDocumentosOcds([
    { id: '1', title: 'Página documentos', url: URL_A },
    { id: '1', title: 'Página documentos', url: URL_A },
    { id: '1', title: 'Página documentos', url: URL_B },
  ]);

  assert.equal(docs.length, 2);
  assert.deepEqual(docs.map((d) => d.url), [URL_A, URL_B]);
});

test('un documento sin url se descarta en vez de guardarse a medias', () => {
  const docs = mapDocumentosOcds([
    { id: '1', title: 'Sin enlace' },
    { id: '2', title: 'Con enlace', url: URL_A },
  ]);

  assert.equal(docs.length, 1);
  assert.equal(docs[0].url, URL_A);
});

test('sin título usable queda un rótulo explícito, nunca vacío', () => {
  // OCDS manda los textos en latin-1 mal etiquetado; un título puede llegar
  // roto o en blanco.
  const [doc] = mapDocumentosOcds([{ id: '1', title: '   ', url: URL_A }]);

  assert.equal(doc.nombre, 'Documentos del proceso en Mercado Público');
});

test('una lista vacía no inventa un adjunto', () => {
  assert.deepEqual(mapDocumentosOcds([]), []);
});
