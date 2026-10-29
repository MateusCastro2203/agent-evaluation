import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analisarSaida, codigoDeSaida, frase, fraseSimples, gerarHtml, tabelaTerminal, tituloSimples } from "../src/relatorio.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/run-32.json", import.meta.url), "utf8"));
const real = JSON.parse(readFileSync(new URL("./fixtures/smoke.json", import.meta.url), "utf8"));

describe("analisarSaida", () => {
  it("lê o smoke real do promptfoo (results.results[].response.metadata.resultado)", () => {
    const a = analisarSaida(real);
    expect(a.resultados.length).toBe(2);
    expect(a.linhasComErro).toBe(0);
    expect(a.resultados[0]!.variante).toBe("a");
  });
  it("separa linhas com erro do harness e não as conta em n", () => {
    const a = analisarSaida(fixture);
    expect(a.linhasComErro).toBe(1);
    expect(a.resultados.length).toBe(32);
    expect(a.resumoA.n).toBe(15);
    expect(a.resumoA.erros).toBe(1);
    expect(a.resumoB.n).toBe(16);
    expect(a.resumoB.passou).toBe(12);
  });
  it("usa o desfecho do metadata, não o success do promptfoo", () => {
    const linha = { provider: { id: "claude-code-a" }, success: true, response: { metadata: { resultado: { ...fixture.results.results[0].metadata.resultado, desfecho: "erro_agente" } } } };
    const a = analisarSaida({ results: { results: [linha] } });
    expect(a.resumoA.erros).toBe(1);
  });
  it("deduz a variante do provider.id quando o resultado não traz", () => {
    const { variante: _v, ...resto } = fixture.results.results[0].metadata.resultado;
    const a = analisarSaida({ results: { results: [{ provider: { id: "claude-code-b" }, response: { metadata: { resultado: resto } } }] } });
    expect(a.resumoB.n).toBe(1);
  });
  it("não quebra com saída vazia ou torta", () => {
    expect(analisarSaida({}).resultados).toEqual([]);
    expect(analisarSaida({ results: { results: [null, {}, { error: "x" }] } }).linhasComErro).toBe(3);
  });
});

describe("veredito e código de saída", () => {
  it("fixture é inconclusivo e sai 0", () => {
    const a = analisarSaida(fixture);
    expect(a.veredito.tipo).toBe("inconclusivo");
    expect(codigoDeSaida(a.veredito)).toBe(0);
  });
  it("a_melhor usa frase neutra", () => {
    const a = analisarSaida(fixture);
    const inv = { ...a, veredito: { tipo: "a_melhor" as const, diferenca: -1, execucoesNecessariasPorVariante: 3, pisoTesteZPorVariante: 2 } };
    expect(frase(inv)).toContain("Neste run, A foi melhor que B (intervalos sem sobreposição)");
  });
  it("só a_melhor sai 1", () => {
    expect(codigoDeSaida({ tipo: "a_melhor", diferenca: -1, execucoesNecessariasPorVariante: 3, pisoTesteZPorVariante: 2 })).toBe(1);
    expect(codigoDeSaida({ tipo: "b_melhor", diferenca: 1, execucoesNecessariasPorVariante: 3, pisoTesteZPorVariante: 2 })).toBe(0);
  });
  it("dados vazios: inconclusivo", () => {
    expect(analisarSaida({}).veredito.tipo).toBe("inconclusivo");
  });
});

describe("gerarHtml", () => {
  const meta = { origem: "resultados/ultimo.json", geradoEm: "2026-10-26T20:00:00.000Z" };
  const html = gerarHtml(analisarSaida(fixture), meta);
  it("é autocontido", () => {
    expect(html).not.toMatch(/<link |<script|src=|https?:\/\//);
  });
  it("é sempre claro, para combinar com o slide em que aparece", () => {
    expect(html).not.toContain("prefers-color-scheme");
  });
  it("abre com o veredito em português simples e as duas taxas", () => {
    const a = analisarSaida(fixture);
    const topo = html.slice(0, html.indexOf("Os números lado a lado"));
    expect(topo).toContain("Ainda não dá para saber");
    expect(topo).toContain(`Sem CLAUDE.md`);
    expect(topo).toContain(`${a.resumoA.passou} de ${a.resumoA.n} deram certo`);
    expect(topo).toContain(`${a.resumoB.passou} de ${a.resumoB.n} deram certo`);
    expect(topo).toContain("a margem de erro das duas se cruza");
    expect(topo).not.toMatch(/Wilson|teste z|pass\^k/);
  });
  it("frase simples cobre os três vereditos e a falta de dado", () => {
    const a = analisarSaida(fixture);
    expect(fraseSimples(a)).toContain(`seriam umas ${a.veredito.execucoesNecessariasPorVariante} execuções de cada`);
    const b = { ...a, veredito: { ...a.veredito, tipo: "b_melhor" as const } };
    expect(tituloSimples(b)).toBe("Com CLAUDE.md foi melhor");
    expect(fraseSimples(b)).toContain("O CLAUDE.md ajudou");
    const am = { ...a, veredito: { ...a.veredito, tipo: "a_melhor" as const } };
    expect(tituloSimples(am)).toBe("Sem CLAUDE.md foi melhor");
    expect(fraseSimples(am)).toContain("atrapalhou");
    expect(tituloSimples(analisarSaida({}))).toBe("Falta dado para comparar");
  });
  it("traz veredito, n por variante, custo e rodapé (detalhes técnicos)", () => {
    expect(html).toContain("Detalhes técnicos");
    expect(html).toContain("Inconclusivo");
    expect(html).toContain("Mexeu onde não devia");
    expect(html).toContain("Resolve sempre?");
    expect(html).toContain("custo estimado (US$, lista; inclui execuções com erro)");
    expect(html).toContain("pass^k (k=2;");
    expect(html).toContain("tokens de cache");
    expect(html).toContain("execuções necessárias por variante (critério do veredito)");
    expect(html).toContain("piso pelo teste z de duas proporções");
    expect(html).toContain("resultados/ultimo.json");
    expect(html).toContain("linhas com erro do harness");
    expect(html).toContain("07-lista-espera");
  });
  it("escapa HTML vindo dos dados", () => {
    const sujo = JSON.parse(JSON.stringify(fixture));
    sujo.results.results[0].metadata.resultado.tarefa = "<img onerror=x>";
    sujo.results.results[0].response.metadata.resultado.tarefa = "<img onerror=x>";
    expect(gerarHtml(analisarSaida(sujo), meta)).not.toContain("<img onerror");
  });
  it("renderiza dados vazios sem exceção", () => {
    expect(gerarHtml(analisarSaida({}), meta)).toContain("Falta dado para comparar");
  });
  it("tabela de terminal tem as duas variantes", () => {
    const t = tabelaTerminal(analisarSaida(fixture));
    expect(t).toMatch(/A \(sem/);
    expect(t).toMatch(/B \(com/);
    expect(t).toContain("execuções necessárias por variante (critério do veredito)");
    expect(t).toContain("piso pelo teste z de duas proporções");
  });
});
