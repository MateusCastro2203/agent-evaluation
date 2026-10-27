import { wilson, type ResumoVariante } from "./metricas.js";

export type Veredito = {
  tipo: "b_melhor" | "a_melhor" | "inconclusivo";
  /** taxa de B menos taxa de A (pontos de 0 a 1). */
  diferenca: number;
  /**
   * Critério do veredito: menor n por variante em que os intervalos de Wilson 95% de A e B,
   * calculados nas taxas observadas, deixam de se sobrepor. `null` quando falta dado, as taxas
   * são iguais ou nem com `LIMITE_EXECUCOES` eles se separam.
   */
  execucoesNecessariasPorVariante: number | null;
  /** Piso pelo teste z de duas proporções (95% de confiança, 80% de poder). Costuma ficar abaixo do critério do veredito. */
  pisoTesteZPorVariante: number | null;
};

const Z_CONFIANCA = 1.96;
const Z_PODER = 0.84;
/** Teto da busca do critério de Wilson. */
export const LIMITE_EXECUCOES = 10_000;

/** Menor n em que wilson(pA·n, n) e wilson(pB·n, n) não se sobrepõem; `null` se as taxas são iguais ou o teto é atingido. */
export function execucoesParaSepararWilson(pA: number, pB: number, limite = LIMITE_EXECUCOES): number | null {
  if (pA === pB) return null;
  for (let n = 1; n <= limite; n++) {
    const a = wilson(pA * n, n);
    const b = wilson(pB * n, n);
    if (b.inf > a.sup || a.inf > b.sup) return n;
  }
  return null;
}

export function pisoTesteZ(pA: number, pB: number): number | null {
  if (pA === pB) return null;
  return Math.ceil(((Z_CONFIANCA + Z_PODER) ** 2 * (pA * (1 - pA) + pB * (1 - pB))) / (pA - pB) ** 2);
}

export function decidir(a: ResumoVariante, b: ResumoVariante): Veredito {
  const pA = a.taxa.p;
  const pB = b.taxa.p;
  const diferenca = pB - pA;
  const semDado = a.n === 0 || b.n === 0;

  let tipo: Veredito["tipo"] = "inconclusivo";
  if (!semDado) {
    if (b.taxa.inf > a.taxa.sup) tipo = "b_melhor";
    else if (a.taxa.inf > b.taxa.sup) tipo = "a_melhor";
  }

  return {
    tipo,
    diferenca,
    execucoesNecessariasPorVariante: semDado ? null : execucoesParaSepararWilson(pA, pB),
    pisoTesteZPorVariante: semDado ? null : pisoTesteZ(pA, pB),
  };
}
