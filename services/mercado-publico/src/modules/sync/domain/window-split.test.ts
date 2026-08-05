import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partirVentana, totalEstimado, tramosTruncados } from './window-split.ts';

/**
 * `partirVentana` recibe la consulta como dependencia, así que se prueba contra
 * distribuciones sintéticas: sin red, sin cuota y con el caso patológico
 * reproducible, que contra la API real no se puede provocar a voluntad.
 */

const H = 3_600_000;
const T0 = new Date('2026-08-05T00:00:00.000Z');
const en = (horas: number): Date => new Date(T0.getTime() + horas * H);

/** Fuente sintética: `porHora` define cuántos cambios ocurren en cada hora. */
function fuente(porHora: number[]): {
  contar: (a: Date, b: Date) => Promise<number>;
  llamadas: () => number;
} {
  let llamadas = 0;
  return {
    llamadas: () => llamadas,
    contar: async (a: Date, b: Date) => {
      llamadas++;
      let total = 0;
      // Prorratea por solapamiento, así media hora de una hora con 100 da 50.
      for (let h = 0; h < porHora.length; h++) {
        const ini = T0.getTime() + h * H;
        const fin = ini + H;
        const solape = Math.min(b.getTime(), fin) - Math.max(a.getTime(), ini);
        if (solape > 0) total += Math.round((porHora[h]! * solape) / H);
      }
      return Math.min(total, 10_000); // la API topa: nunca informa más
    },
  };
}

// ── Lo que este archivo existe para impedir ──────────────────

test('una ventana que topa el techo se parte hasta quedar bajo el techo', () => {
  // 24 h con 2.000 cambios por hora = 48.000: casi 5 veces el techo.
  const { contar } = fuente(Array(24).fill(2000));
  return partirVentana(T0, en(24), contar).then((r) => {
    assert.ok(r.tramos.length > 1, 'debía partirse');
    for (const t of r.tramos) {
      assert.ok(t.estimado < 10_000, `tramo con ${t.estimado} sigue topado`);
    }
  });
});

test('los tramos cubren la ventana entera SIN huecos', async () => {
  // Un hueco es pérdida de datos silenciosa, que es justo lo que esto evita.
  const { contar } = fuente(Array(24).fill(2000));
  const { tramos } = await partirVentana(T0, en(24), contar);

  assert.equal(tramos[0]!.desde, T0.toISOString(), 'no arranca al principio');
  assert.equal(tramos.at(-1)!.hasta, en(24).toISOString(), 'no llega al final');
  for (let i = 1; i < tramos.length; i++) {
    assert.equal(
      tramos[i]!.desde,
      tramos[i - 1]!.hasta,
      `hueco entre el tramo ${i - 1} y el ${i}`,
    );
  }
});

test('los tramos salen en orden cronológico', async () => {
  const { contar } = fuente(Array(24).fill(2000));
  const { tramos } = await partirVentana(T0, en(24), contar);
  for (let i = 1; i < tramos.length; i++) {
    assert.ok(
      new Date(tramos[i]!.desde) >= new Date(tramos[i - 1]!.desde),
      'los tramos no están ordenados',
    );
  }
});

test('no se parte lo que ya cabe: una sola consulta', async () => {
  const { contar, llamadas } = fuente(Array(24).fill(10));
  const { tramos, sondeos } = await partirVentana(T0, en(24), contar);
  assert.equal(tramos.length, 1);
  assert.equal(sondeos, 1, 'sondeó de más una ventana que ya cabía');
  assert.equal(llamadas(), 1);
});

test('la actividad concentrada parte fino donde hace falta y grueso donde no', async () => {
  // Madrugada muerta, mañana intensa: el caso real de Mercado Público.
  const porHora = [...Array(8).fill(5), ...Array(8).fill(4000), ...Array(8).fill(5)];
  const { contar } = fuente(porHora);
  const { tramos } = await partirVentana(T0, en(24), contar);

  const duracion = (t: { desde: string; hasta: string }): number =>
    new Date(t.hasta).getTime() - new Date(t.desde).getTime();
  const enMadrugada = tramos.filter((t) => new Date(t.desde) < en(8));
  const enMañana = tramos.filter(
    (t) => new Date(t.desde) >= en(8) && new Date(t.desde) < en(16),
  );

  assert.ok(enMañana.length > enMadrugada.length, 'no afinó donde había volumen');
  const maxMañana = Math.max(...enMañana.map(duracion));
  const maxMadrugada = Math.max(...enMadrugada.map(duracion));
  assert.ok(maxMadrugada > maxMañana, 'partió la madrugada tan fino como la mañana');
});

test('los tramos vacíos se descartan', async () => {
  // Sin esto, una corrida de madrugada genera decenas de paginaciones sobre nada.
  const porHora = [...Array(20).fill(0), ...Array(4).fill(50)];
  const { contar } = fuente(porHora);
  const { tramos } = await partirVentana(T0, en(24), contar);
  assert.ok(tramos.every((t) => t.estimado > 0), 'quedó un tramo vacío');
});

test('lo que no se puede partir más se marca truncado, no se traga', async () => {
  // Fuente patológica: siempre devuelve el techo, aunque el tramo sea de un
  // minuto. Es el caso que NO debe terminar en un 'success' silencioso.
  const contar = async (): Promise<number> => 10_000;
  const { tramos } = await partirVentana(T0, en(1), contar, { minMs: 60_000 });
  assert.ok(tramos.length > 0);
  assert.ok(tramosTruncados(tramos).length > 0, 'no marcó nada como truncado');
});

test('el presupuesto de sondeos acota el costo y lo declara', async () => {
  const contar = async (): Promise<number> => 10_000;
  const r = await partirVentana(T0, en(24), contar, { maxSondeos: 5 });
  assert.ok(r.sondeos <= 5, 'se pasó del presupuesto de sondeos');
  assert.equal(r.incompleto, true, 'no declaró que quedó incompleto');
});

test('totalEstimado suma lo que se espera ingerir', () => {
  const tramos = [
    { desde: 'a', hasta: 'b', estimado: 100, truncado: false },
    { desde: 'b', hasta: 'c', estimado: 250, truncado: false },
  ];
  assert.equal(totalEstimado(tramos), 350);
});

test('una ventana vacía no produce tramos', async () => {
  const { contar } = fuente(Array(24).fill(0));
  const { tramos } = await partirVentana(T0, en(24), contar);
  assert.equal(tramos.length, 0);
});

test('un sondeo que falla PROPAGA — jamás se convierte en cero', async () => {
  // El caso más peligroso de todos. Si la sonda devolviera 0 ante un error
  // (cuota agotada, red caída), la ventana entera se daría por vacía, el sync no
  // ingeriría nada y cerraría en verde. Pasó de verdad el 2026-08-05 en un
  // script de diagnóstico que leía `payload?.paginacion?.total_resultados ?? 0`
  // sobre una respuesta `success: NOK` con código 429.
  //
  // "No hay nada" y "no pudimos preguntar" tienen que ser distinguibles.
  const contar = async (): Promise<number> => {
    throw new Error('429 cuota agotada');
  };
  await assert.rejects(() => partirVentana(T0, en(24), contar), /cuota agotada/);
});

test('un fallo a mitad de la exploración tampoco se traga', async () => {
  let n = 0;
  const contar = async (): Promise<number> => {
    n++;
    if (n > 2) throw new Error('429 cuota agotada');
    return 10_000; // fuerza al menos una subdivisión antes de romperse
  };
  await assert.rejects(() => partirVentana(T0, en(24), contar), /cuota agotada/);
});
