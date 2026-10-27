import type { Desfecho, ResultadoExecucao } from "./executor.js";
import { resumir, type Intervalo, type ResumoVariante } from "./metricas.js";
import { decidir, LIMITE_EXECUCOES, type Veredito } from "./veredito.js";

export interface Analise {
  resultados: ResultadoExecucao[];
  /** Linhas do promptfoo sem `metadata.resultado` (ex.: erro do provider): fora do n. */
  linhasComErro: number;
  resumoA: ResumoVariante;
  resumoB: ResumoVariante;
  veredito: Veredito;
  /** Primeiro `modelo` encontrado nos metadados, se algum. */
  modelo?: string;
  /** `results.timestamp` do promptfoo, se houver. */
  timestamp?: string;
}

const DESFECHOS: Desfecho[] = ["passou", "falhou", "fora_do_escopo", "erro_agente"];

function ehObjeto(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null;
}

function varianteDe(linha: Record<string, any>, resultado: Record<string, any>): "a" | "b" | null {
  const v = resultado.variante;
  if (v === "a" || v === "b") return v;
  const id = String(linha.provider?.id ?? "");
  if (id.endsWith("-a")) return "a";
  if (id.endsWith("-b")) return "b";
  return null;
}

/**
 * Lê a saída do promptfoo (`-o resultado.json`). O desfecho vem de `response.metadata.resultado`
 * (o do executor), nunca de `success`: o promptfoo não distingue `erro_agente` de `falhou`.
 */
export function analisarSaida(saida: unknown): Analise {
  const bruto = ehObjeto(saida) ? saida.results : undefined;
  const linhas: unknown[] = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.results) ? bruto.results : [];
  const timestamp = typeof bruto?.timestamp === "string" ? bruto.timestamp : undefined;

  const resultados: ResultadoExecucao[] = [];
  let linhasComErro = 0;
  let modelo: string | undefined;
  for (const linha of linhas) {
    if (!ehObjeto(linha)) {
      linhasComErro++;
      continue;
    }
    const r = linha.response?.metadata?.resultado ?? linha.metadata?.resultado;
    const variante = ehObjeto(r) ? varianteDe(linha, r) : null;
    if (!ehObjeto(r) || !variante || !DESFECHOS.includes(r.desfecho) || typeof r.tarefa !== "string" || !ehObjeto(r.agente)) {
      linhasComErro++;
      continue;
    }
    modelo ??= [r.modelo, r.agente.modelo, linha.response?.metadata?.modelo, linha.metadata?.modelo].find((m) => typeof m === "string");
    resultados.push({ ...(r as ResultadoExecucao), variante });
  }

  const resumoA = resumir(resultados, "a");
  const resumoB = resumir(resultados, "b");
  return { resultados, linhasComErro, resumoA, resumoB, veredito: decidir(resumoA, resumoB), modelo, timestamp };
}

/** 1 só quando A é claramente melhor que B (o portão do CI). */
export function codigoDeSaida(v: Veredito): 0 | 1 {
  return v.tipo === "a_melhor" ? 1 : 0;
}

// ---------- formatação (pt-BR) ----------

const num = (x: number, casas = 0) => x.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (x: number, casas = 0) => `${num(x * 100, casas)}%`;
const taxaTexto = (r: ResumoVariante) => (r.n === 0 ? "sem dados" : `${pct(r.taxa.p)} (${pct(r.taxa.inf)} a ${pct(r.taxa.sup)})`);
const ou = (x: number | null, f: (n: number) => string) => (x === null ? "—" : f(x));
const usd = (x: number) => `US$ ${num(x, 2)}`;
const segundos = (ms: number) => `${num(ms / 1000, 1)} s`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function frase(a: Analise, comRotulo = true): string {
  const r = (t: string, f: string) => (comRotulo ? `${t} ${f}` : f);
  const { resumoA: A, resumoB: B, veredito: v } = a;
  const base = `A: ${A.passou} de ${A.n} (${pct(A.taxa.p)}) · B: ${B.passou} de ${B.n} (${pct(B.taxa.p)})`;
  if (A.n === 0 || B.n === 0) return r("Inconclusivo:", `falta dado. ${base}. Sem execuções de uma das variantes não há comparação.`);
  if (v.tipo === "b_melhor") return `Com CLAUDE.md foi melhor. ${base}, e os intervalos de 95% não se sobrepõem.`;
  if (v.tipo === "a_melhor") return `Neste run, A foi melhor que B (intervalos sem sobreposição). ${base}.`;
  return `${comRotulo ? "Inconclusivo. " : ""}${base}. Os intervalos de 95% se sobrepõem: com esse n, não dá para dizer se o CLAUDE.md ajuda.`;
}

function titulo(v: Veredito, a: Analise): string {
  if (a.resumoA.n === 0 || a.resumoB.n === 0) return "Inconclusivo";
  return { b_melhor: "B melhor", a_melhor: "A melhor", inconclusivo: "Inconclusivo" }[v.tipo];
}

function kDe(a: Analise): number {
  return Math.max(a.resumoA.k, a.resumoB.k);
}

function motivoSemEstimativa(a: Analise): string {
  if (a.resumoA.n === 0 || a.resumoB.n === 0) return "não calculável: falta dado em uma variante";
  if (a.resumoA.taxa.p === a.resumoB.taxa.p) return "não calculável: as taxas são iguais";
  return `não calculável: nem com ${num(LIMITE_EXECUCOES)} por variante os intervalos se separam`;
}

function execucoesTexto(a: Analise): string {
  const n = a.veredito.execucoesNecessariasPorVariante;
  if (n === null) return motivoSemEstimativa(a);
  return `${num(n)} por variante (onde os intervalos de Wilson 95% deixam de se sobrepor, nas taxas observadas), contra ${num(Math.max(a.resumoA.n, a.resumoB.n))} feitas`;
}

function pisoTexto(a: Analise): string {
  const n = a.veredito.pisoTesteZPorVariante;
  if (n === null) return motivoSemEstimativa(a);
  return `${num(n)} por variante (95% de confiança, 80% de poder)`;
}

// ---------- terminal ----------

export function tabelaTerminal(a: Analise): string {
  const { resumoA: A, resumoB: B } = a;
  const linhas: [string, string, string][] = [
    ["", "A (sem CLAUDE.md)", "B (com CLAUDE.md)"],
    ["n (sem erro do agente)", String(A.n), String(B.n)],
    ["passou", `${A.passou}/${A.n}`, `${B.passou}/${B.n}`],
    ["taxa (Wilson 95%)", taxaTexto(A), taxaTexto(B)],
    [`pass^k (k=${kDe(a)}; erro do agente conta como não passou)`, `${A.passK}/${A.tarefasTotal}`, `${B.passK}/${B.tarefasTotal}`],
    ["fora do escopo", String(A.foraDoEscopo), String(B.foraDoEscopo)],
    ["erros do agente", String(A.erros), String(B.erros)],
    ["mediana tokens (entrada + saída)", ou(A.medianaTokens, (x) => num(x)), ou(B.medianaTokens, (x) => num(x))],
    ["mediana tokens de cache (leitura + criação)", ou(A.medianaTokensCache, (x) => num(x)), ou(B.medianaTokensCache, (x) => num(x))],
    ["mediana turnos", ou(A.medianaTurnos, (x) => num(x, 1)), ou(B.medianaTurnos, (x) => num(x, 1))],
    ["mediana duração", ou(A.medianaDuracaoMs, segundos), ou(B.medianaDuracaoMs, segundos)],
    ["custo estimado (US$, lista; inclui execuções com erro)", usd(A.custoTotalUsd), usd(B.custoTotalUsd)],
  ];
  const larg = [0, 1, 2].map((i) => Math.max(...linhas.map((l) => l[i]!.length)));
  const fmt = (l: [string, string, string]) => l.map((c, i) => c.padEnd(larg[i]!)).join("  ").trimEnd();
  const extra = a.linhasComErro > 0 ? `\nlinhas com erro do harness (fora do n): ${a.linhasComErro}` : "";
  return `${fmt(linhas[0]!)}\n${"-".repeat(larg[0]! + larg[1]! + larg[2]! + 4)}\n${linhas.slice(1).map(fmt).join("\n")}\n\n${frase(a)}\nexecuções necessárias por variante (critério do veredito): ${execucoesTexto(a)}\npiso pelo teste z de duas proporções: ${pisoTexto(a)}${extra}`;
}

// ---------- HTML ----------

export interface MetaRelatorio {
  origem: string;
  geradoEm: string;
}

function barra(rotulo: string, r: ResumoVariante, cor: string): string {
  const t: Intervalo = r.taxa;
  const sem = r.n === 0;
  return `<div class="linha-barra"><div class="rot-barra">${rotulo}<small>${esc(taxaTexto(r))}</small></div>
<div class="escala" role="img" aria-label="${esc(rotulo)}: ${esc(taxaTexto(r))}">
${sem ? "" : `<div class="iv" style="left:${(t.inf * 100).toFixed(1)}%;width:${((t.sup - t.inf) * 100).toFixed(1)}%;background:var(${cor})"></div><div class="pt" style="left:calc(${(t.p * 100).toFixed(1)}% - 3px)"></div>`}
</div></div>`;
}

export function gerarHtml(a: Analise, meta: MetaRelatorio): string {
  const { resumoA: A, resumoB: B, veredito: v } = a;
  const classeVeredito = A.n === 0 || B.n === 0 ? "inconclusivo" : v.tipo.replace("_", "-");
  const tarefas = [...new Set([...Object.keys(A.porTarefa), ...Object.keys(B.porTarefa)])].sort();
  const cel = (t: { passou: number; n: number } | undefined) => {
    if (!t) return `<td class="num">—</td>`;
    const cls = t.n === 0 ? "" : t.passou === t.n ? "ok" : t.passou === 0 ? "ruim" : "meio";
    return `<td class="num ${cls}">${t.passou}/${t.n}</td>`;
  };
  const par = (rotulo: string, fa: string, fb: string) => `<tr><th scope="row">${rotulo}</th><td class="num">${fa}</td><td class="num">${fb}</td></tr>`;
  const rodape = [
    `fonte: <code>${esc(meta.origem)}</code>`,
    `gerado em ${esc(meta.geradoEm)}`,
    a.timestamp ? `run de ${esc(a.timestamp)}` : "",
    a.modelo ? `modelo: ${esc(a.modelo)}` : "",
    `linhas com erro do harness (fora do n): ${a.linhasComErro}`,
  ].filter(Boolean).join(" · ");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Medindo agentes — relatório</title>
<style>
:root{--fundo:#f6f7f9;--painel:#fff;--tinta:#14181f;--suave:#586070;--linha:#d5d9e0;--azul:#2f6fdb;--acento:#d97706;--ok:#0d7a3e;--ruim:#b42318;--meio:#8a5a00;--neutro:#e8ecf3;}
@media (prefers-color-scheme: dark){:root{--fundo:#0f1218;--painel:#181d27;--tinta:#eef1f6;--suave:#a3adbf;--linha:#2d3544;--azul:#6ea2ff;--acento:#f5a524;--ok:#4ade80;--ruim:#ff7b72;--meio:#f5c451;--neutro:#232a38;}}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--tinta);font:22px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px 48px 18px}
h1{font-size:30px;margin:0 0 4px;color:var(--suave);font-weight:600}
h2{font-size:28px;margin:20px 0 8px}
.veredito{background:var(--painel);border:2px solid var(--linha);border-left:14px solid var(--suave);border-radius:12px;padding:12px 28px;margin:12px 0}
.veredito.inconclusivo{border-left-color:var(--acento)}
.veredito.b-melhor{border-left-color:var(--ok)}
.veredito.a-melhor{border-left-color:var(--ruim)}
.veredito .titulo{font-size:60px;font-weight:800;line-height:1.1}
.veredito .frase{font-size:28px;margin-top:8px}
.veredito .nec{font-size:22px;color:var(--suave);margin-top:10px}
.veredito .nec.piso{font-size:18px;margin-top:2px}
table{border-collapse:collapse;width:100%;background:var(--painel);border-radius:8px;overflow:hidden}
th,td{padding:5px 16px;border-bottom:1px solid var(--linha);text-align:left}
thead th{font-size:22px;background:var(--neutro)}
td.num,thead th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}
th[scope=row]{font-weight:500}
.ok{color:var(--ok);font-weight:700}.ruim{color:var(--ruim);font-weight:700}.meio{color:var(--meio);font-weight:700}
.linha-barra{display:grid;grid-template-columns:340px 1fr;align-items:center;gap:20px;margin:6px 0}
.rot-barra{font-weight:700}.rot-barra small{display:block;font-weight:400;color:var(--suave);font-size:20px}
.escala{position:relative;height:48px;background:var(--neutro);border-radius:6px;background-image:linear-gradient(to right,var(--linha) 1px,transparent 1px);background-size:25% 100%}
.iv{position:absolute;top:9px;height:30px;border-radius:4px;opacity:.85}
.pt{position:absolute;top:2px;width:6px;height:44px;background:var(--tinta);border-radius:2px}
.eixo{display:grid;grid-template-columns:340px 1fr;gap:20px;color:var(--suave);font-size:20px}
.eixo div{display:flex;justify-content:space-between}
.por-tarefa{font-size:20px}.por-tarefa th,.por-tarefa td{padding:2px 16px}
footer{margin-top:16px;color:var(--suave);font-size:17px}
code{font-family:ui-monospace,Menlo,monospace}
</style>
</head>
<body>
<h1>Medindo agentes · A (sem CLAUDE.md) × B (com CLAUDE.md)</h1>
<section class="veredito ${classeVeredito}">
<div class="titulo">${titulo(v, a)}</div>
<div class="frase">${esc(frase(a, false))}</div>
<div class="nec">execuções necessárias por variante (critério do veredito): ${esc(execucoesTexto(a))}</div>
<div class="nec piso">piso pelo teste z de duas proporções: ${esc(pisoTexto(a))}</div>
</section>

<h2>A × B</h2>
<table>
<thead><tr><th></th><th>A (sem CLAUDE.md)</th><th>B (com CLAUDE.md)</th></tr></thead>
<tbody>
${par("n (sem erro do agente)", String(A.n), String(B.n))}
${par("taxa de sucesso (Wilson 95%)", esc(taxaTexto(A)), esc(taxaTexto(B)))}
${par(`pass^k (k=${kDe(a)}; tarefas que passaram em todas as repetições; erro do agente conta como não passou)`, `${A.passK} de ${A.tarefasTotal}`, `${B.passK} de ${B.tarefasTotal}`)}
${par("fora do escopo", String(A.foraDoEscopo), String(B.foraDoEscopo))}
${par("erros do agente (fora do n)", String(A.erros), String(B.erros))}
${par("tokens (entrada + saída), mediana", ou(A.medianaTokens, (x) => num(x)), ou(B.medianaTokens, (x) => num(x)))}
${par("tokens de cache (leitura + criação), mediana", ou(A.medianaTokensCache, (x) => num(x)), ou(B.medianaTokensCache, (x) => num(x)))}
${par("mediana de turnos", ou(A.medianaTurnos, (x) => num(x, 1)), ou(B.medianaTurnos, (x) => num(x, 1)))}
${par("mediana de duração", ou(A.medianaDuracaoMs, segundos), ou(B.medianaDuracaoMs, segundos))}
${par("custo estimado (US$, lista; inclui execuções com erro)", usd(A.custoTotalUsd), usd(B.custoTotalUsd))}
</tbody>
</table>

<h2>Intervalo de 95% por variante</h2>
${barra("A · sem CLAUDE.md", A, "--azul")}
${barra("B · com CLAUDE.md", B, "--acento")}
<div class="eixo"><span></span><div><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></div>

<h2>Por tarefa (passou/n)</h2>
<table class="por-tarefa">
<thead><tr><th>tarefa</th><th>A</th><th>B</th></tr></thead>
<tbody>
${tarefas.map((t) => `<tr><th scope="row">${esc(t)}</th>${cel(A.porTarefa[t])}${cel(B.porTarefa[t])}</tr>`).join("\n") || `<tr><td colspan="3">sem execuções</td></tr>`}
</tbody>
</table>

<footer>${rodape}</footer>
</body>
</html>
`;
}
