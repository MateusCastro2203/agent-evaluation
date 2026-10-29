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
// O HTML é o que aparece no slide do relatório ao vivo, para uma plateia majoritariamente iniciante:
// em cima, o veredito em português simples e as duas taxas; os termos técnicos (Wilson, teste z,
// tokens de cache…) ficam na seção "Detalhes técnicos", mais abaixo. Nenhum cálculo muda aqui.

export interface MetaRelatorio {
  origem: string;
  geradoEm: string;
}

const faltaDado = (a: Analise) => a.resumoA.n === 0 || a.resumoB.n === 0;

/** Título do veredito em palavras simples. */
export function tituloSimples(a: Analise): string {
  if (faltaDado(a)) return "Falta dado para comparar";
  return { b_melhor: "Com CLAUDE.md foi melhor", a_melhor: "Sem CLAUDE.md foi melhor", inconclusivo: "Ainda não dá para saber" }[a.veredito.tipo];
}

/** A frase do veredito para iniciantes (o "porquê" em uma linha). */
export function fraseSimples(a: Analise): string {
  const { resumoA: A, resumoB: B, veredito: v } = a;
  if (faltaDado(a)) return "Uma das variantes ficou sem nenhuma execução válida, então não há o que comparar.";
  if (v.tipo === "b_melhor") return "O CLAUDE.md ajudou: mesmo contando a margem de erro, as duas não se cruzam.";
  if (v.tipo === "a_melhor") return "Neste run, o CLAUDE.md atrapalhou: mesmo contando a margem de erro, as duas não se cruzam.";
  const feitas = Math.max(A.n, B.n);
  const n = v.execucoesNecessariasPorVariante;
  if (A.taxa.p === B.taxa.p) return `Ainda não dá para saber se o CLAUDE.md ajuda: as duas deram certo na mesma proporção, com ${num(feitas)} execuções de cada.`;
  if (n === null) return `Ainda não dá para saber se o CLAUDE.md ajuda: a margem de erro das duas se cruza, e a diferença é pequena demais para separar nem com ${num(LIMITE_EXECUCOES)} execuções de cada.`;
  return `Ainda não dá para saber se o CLAUDE.md ajuda: a margem de erro das duas se cruza. Para ter certeza, seriam umas ${num(n)} execuções de cada (hoje foram ${num(feitas)}).`;
}

const deramCerto = (r: ResumoVariante) => (r.n === 0 ? "nenhuma execução válida" : `${r.passou} de ${r.n} deram certo`);
const margemTexto = (r: ResumoVariante) => (r.n === 0 ? "sem dados" : `margem de erro: ${pct(r.taxa.inf)} a ${pct(r.taxa.sup)}`);

function linhaVariante(nome: string, letra: string, r: ResumoVariante, cor: string): string {
  const t: Intervalo = r.taxa;
  const sem = r.n === 0;
  const rotulo = `${nome}: ${deramCerto(r)}`;
  return `<div class="variante">
<div class="var-texto"><span class="var-nome">${nome} <small>(${letra})</small></span><span class="var-taxa">${esc(deramCerto(r))}${sem ? "" : ` · <b>${pct(t.p)}</b>`}</span></div>
<div class="escala" role="img" aria-label="${esc(rotulo)}; ${esc(margemTexto(r))}">
${sem ? "" : `<div class="iv" style="left:${(t.inf * 100).toFixed(1)}%;width:${((t.sup - t.inf) * 100).toFixed(1)}%;background:var(${cor})"></div><div class="pt" style="left:calc(${(t.p * 100).toFixed(1)}% - 3px)"></div>`}
</div>
<div class="var-margem">${esc(margemTexto(r))}</div>
</div>`;
}

export function gerarHtml(a: Analise, meta: MetaRelatorio): string {
  const { resumoA: A, resumoB: B, veredito: v } = a;
  const classeVeredito = faltaDado(a) ? "inconclusivo" : v.tipo.replace("_", "-");
  const tarefas = [...new Set([...Object.keys(A.porTarefa), ...Object.keys(B.porTarefa)])].sort();
  const cel = (t: { passou: number; n: number } | undefined) => {
    if (!t) return `<td class="num">—</td>`;
    const cls = t.n === 0 ? "" : t.passou === t.n ? "ok" : t.passou === 0 ? "ruim" : "meio";
    return `<td class="num ${cls}">${t.passou} de ${t.n}</td>`;
  };
  const par = (rotulo: string, fa: string, fb: string) => `<tr><th scope="row">${rotulo}</th><td class="num">${fa}</td><td class="num">${fb}</td></tr>`;
  const k = kDe(a);
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
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--tinta);font:22px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px 40px 18px}
h1{font-size:22px;margin:0 0 8px;color:var(--suave);font-weight:600}
h2{font-size:28px;margin:28px 0 8px}
h2 small{font-size:20px;font-weight:400;color:var(--suave)}
.veredito{background:var(--painel);border:2px solid var(--linha);border-left:14px solid var(--suave);border-radius:12px;padding:10px 26px 12px;margin:0 0 12px}
.veredito.inconclusivo{border-left-color:var(--acento)}
.veredito.b-melhor{border-left-color:var(--ok)}
.veredito.a-melhor{border-left-color:var(--ruim)}
.veredito .titulo{font-size:48px;font-weight:800;line-height:1.1}
.veredito .frase{font-size:26px;margin-top:6px}
.variante{display:grid;grid-template-columns:1fr 1fr;column-gap:28px;align-items:center;margin:10px 0}
.var-texto{display:flex;flex-direction:column}
.var-nome{font-size:30px;font-weight:700}.var-nome small{font-size:20px;font-weight:400;color:var(--suave)}
.var-taxa{font-size:30px}
.var-margem{grid-column:2;font-size:18px;color:var(--suave);margin-top:2px}
.escala{position:relative;height:44px;background:var(--neutro);border-radius:6px;background-image:linear-gradient(to right,var(--linha) 1px,transparent 1px);background-size:25% 100%}
.iv{position:absolute;top:8px;height:28px;border-radius:4px;opacity:.85}
.pt{position:absolute;top:2px;width:6px;height:40px;background:var(--tinta);border-radius:2px}
.eixo{display:grid;grid-template-columns:1fr 1fr;column-gap:28px;color:var(--suave);font-size:18px}
.eixo div{grid-column:2;display:flex;justify-content:space-between}
.legenda{font-size:18px;color:var(--suave);margin:4px 0 0}
table{border-collapse:collapse;width:100%;background:var(--painel);border-radius:8px;overflow:hidden}
th,td{padding:5px 16px;border-bottom:1px solid var(--linha);text-align:left}
thead th{font-size:22px;background:var(--neutro)}
td.num,thead th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}
th[scope=row]{font-weight:500}
th[scope=row] small{color:var(--suave);font-weight:400}
.ok{color:var(--ok);font-weight:700}.ruim{color:var(--ruim);font-weight:700}.meio{color:var(--meio);font-weight:700}
.por-tarefa{font-size:20px}.por-tarefa th,.por-tarefa td{padding:2px 16px}
.tecnico{font-size:18px;color:var(--suave)}
.tecnico table{font-size:18px}.tecnico td.num{white-space:nowrap}
.tecnico ul{margin:8px 0;padding-left:1.2em}
footer{margin-top:16px;color:var(--suave);font-size:17px}
code{font-family:ui-monospace,Menlo,monospace}
</style>
</head>
<body>
<h1>Medindo agentes · o mesmo pedido, sem e com <code>CLAUDE.md</code></h1>
<section class="veredito ${classeVeredito}">
<div class="titulo">${esc(tituloSimples(a))}</div>
<div class="frase">${esc(fraseSimples(a))}</div>
</section>

${linhaVariante("Sem CLAUDE.md", "A", A, "--azul")}
${linhaVariante("Com CLAUDE.md", "B", B, "--acento")}
<div class="eixo"><span></span><div><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></div>
<p class="legenda">O tracinho é o resultado de hoje; a faixa colorida é a margem de erro. Se as faixas se cruzam, ainda não dá para dizer quem é melhor.</p>

<h2>Os números lado a lado</h2>
<table>
<thead><tr><th></th><th>Sem CLAUDE.md (A)</th><th>Com CLAUDE.md (B)</th></tr></thead>
<tbody>
${par("Deram certo", esc(A.n === 0 ? "—" : `${A.passou} de ${A.n} (${pct(A.taxa.p)})`), esc(B.n === 0 ? "—" : `${B.passou} de ${B.n} (${pct(B.taxa.p)})`))}
${par("Margem de erro", esc(A.n === 0 ? "—" : `${pct(A.taxa.inf)} a ${pct(A.taxa.sup)}`), esc(B.n === 0 ? "—" : `${pct(B.taxa.inf)} a ${pct(B.taxa.sup)}`))}
${par(`Resolve sempre? <small>(tarefas que passaram nas ${k} tentativas)</small>`, `${A.passK} de ${A.tarefasTotal}`, `${B.passK} de ${B.tarefasTotal}`)}
${par("Mexeu onde não devia <small>(fora do escopo)</small>", String(A.foraDoEscopo), String(B.foraDoEscopo))}
${par("Erro do agente <small>(rede, login, limite; não entra na conta)</small>", String(A.erros), String(B.erros))}
${par("Voltas com as ferramentas <small>(turnos, mediana)</small>", ou(A.medianaTurnos, (x) => num(x, 1)), ou(B.medianaTurnos, (x) => num(x, 1)))}
${par("Tempo por execução <small>(mediana)</small>", ou(A.medianaDuracaoMs, segundos), ou(B.medianaDuracaoMs, segundos))}
${par("Custo estimado do run <small>(US$)</small>", usd(A.custoTotalUsd), usd(B.custoTotalUsd))}
</tbody>
</table>

<h2>Tarefa por tarefa <small>(quantas deram certo)</small></h2>
<table class="por-tarefa">
<thead><tr><th>tarefa</th><th>Sem CLAUDE.md (A)</th><th>Com CLAUDE.md (B)</th></tr></thead>
<tbody>
${tarefas.map((t) => `<tr><th scope="row">${esc(t)}</th>${cel(A.porTarefa[t])}${cel(B.porTarefa[t])}</tr>`).join("\n") || `<tr><td colspan="3">sem execuções</td></tr>`}
</tbody>
</table>
<p class="legenda">As tarefas 03 a 07 dependem de uma convenção que só o <code>CLAUDE.md</code> explica; 01, 02 e 08 são de controle.</p>

<section class="tecnico">
<h2>Detalhes técnicos</h2>
<ul>
<li>veredito técnico: <b>${titulo(v, a)}</b> · ${esc(frase(a, false))}</li>
<li>a margem de erro é o intervalo de Wilson, 95% de confiança</li>
<li>execuções necessárias por variante (critério do veredito): ${esc(execucoesTexto(a))}</li>
<li>piso pelo teste z de duas proporções: ${esc(pisoTexto(a))}</li>
</ul>
<table>
<thead><tr><th></th><th>A</th><th>B</th></tr></thead>
<tbody>
${par("n (sem erro do agente)", String(A.n), String(B.n))}
${par("taxa de sucesso (Wilson 95%)", esc(taxaTexto(A)), esc(taxaTexto(B)))}
${par(`pass^k (k=${k}; tarefas que passaram em todas as repetições; erro do agente conta como não passou)`, `${A.passK} de ${A.tarefasTotal}`, `${B.passK} de ${B.tarefasTotal}`)}
${par("tokens (entrada + saída), mediana", ou(A.medianaTokens, (x) => num(x)), ou(B.medianaTokens, (x) => num(x)))}
${par("tokens de cache (leitura + criação), mediana", ou(A.medianaTokensCache, (x) => num(x)), ou(B.medianaTokensCache, (x) => num(x)))}
${par("custo estimado (US$, lista; inclui execuções com erro)", usd(A.custoTotalUsd), usd(B.custoTotalUsd))}
</tbody>
</table>
</section>

<footer>${rodape}</footer>
</body>
</html>
`;
}
