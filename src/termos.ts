// Regras do `pnpm checar-termos` (scripts/checar-termos.ts), separadas para dar para testar.

const LETRA = String.raw`[\p{L}\p{N}_]`;

/** Termo → regex global, sem diferenciar maiúsculas; borda de palavra onde o termo começa ou termina com letra/dígito. */
export function regexDoTermo(termo: string): RegExp {
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ini = /^[\p{L}\p{N}_]/u.test(termo) ? `(?<!${LETRA})` : "";
  const fim = /[\p{L}\p{N}_]$/u.test(termo) ? `(?!${LETRA})` : "";
  return new RegExp(`${ini}${escapado}${fim}`, "giu");
}

function trechos(re: RegExp, linha: string): [number, number][] {
  return [...linha.matchAll(new RegExp(re.source, "giu"))].map((m) => [m.index, m.index + m[0].length]);
}

/**
 * Termos que aparecem na linha. Uma ocorrência só é ignorada quando cabe inteira dentro de uma
 * palavra liberada (ex.: o termo "Credit" dentro de "Creditas"). Um termo que contém uma palavra
 * liberada, ou que vai além dela, continua sendo achado.
 */
export function termosNaLinha(linha: string, termos: string[], liberadas: string[] = []): string[] {
  const livres = liberadas.flatMap((p) => trechos(regexDoTermo(p), linha));
  return termos.filter((termo) =>
    trechos(regexDoTermo(termo), linha).some(([i, f]) => !livres.some(([li, lf]) => li <= i && f <= lf)),
  );
}

/**
 * Código de saída: 1 se achou termo; 2 se algum PDF/PPTX não pôde ser lido (o texto dele não foi
 * checado), a menos que `semPdfPermitido` (CHECAR_SEM_PDF=1); senão 0.
 */
export function codigoDaChecagem(achados: number, ilegiveis: number, semPdfPermitido: boolean): 0 | 1 | 2 {
  if (achados > 0) return 1;
  if (ilegiveis > 0 && !semPdfPermitido) return 2;
  return 0;
}
