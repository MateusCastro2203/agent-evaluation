/**
 * pnpm material: gera os arquivos da palestra "Como medir os seus agentes de IA".
 *
 *   palestra/slides.md     → palestra/apresentacao.html (a que se apresenta: avança fragmentos no clique,
 *                            tecla p abre as notas; autocontida, sem rede) + apresentacao.pdf e .pptx
 *                            (material de apoio: cada slide no estado final; o PPTX leva as notas)
 *   palestra/<nome>.json   → palestra/<nome>.pdf (ex.: guia-de-fala.json)
 *   ebook/ebook.json       → ebook/ebook.pdf
 *
 * Entrada ausente é pulada com um aviso. Precisa de Chrome, Edge ou Chromium (ou CHROME_PATH).
 * REPO_URL (opcional): base para transformar links relativos em links do GitHub; vazio = texto simples.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { marpCli } from "@marp-team/marp-cli";
import { Marked } from "marked";

const RAIZ = resolve(import.meta.dirname, "..");
const TEMA_SLIDES = join(RAIZ, "material/tema-slides.css");
const CSS_APOSTILA = join(RAIZ, "material/apostila.css");
const REPO_URL = (process.env.REPO_URL ?? "").replace(/\/+$/, "");

/** Escapa texto que vai direto para o HTML (títulos e subtítulos dos manifestos). */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Fonte {
  /** Caminho a partir da raiz do repositório. */
  arquivo: string;
  /** Título do capítulo na apostila. */
  titulo: string;
  /** Se presente, inclui só estas seções (texto exato do título); senão, o arquivo inteiro sem o H1. */
  secoes?: string[];
}

interface ConfigApostila {
  /** Rótulo pequeno acima do título da capa (padrão: "Apostila"). */
  selo?: string;
  titulo: string;
  subtitulo: string;
  fontes: Fonte[];
}

const PALESTRA = join(RAIZ, "palestra");
const EBOOK = join(RAIZ, "ebook");

if (existsSync(join(PALESTRA, "slides.md"))) await gerarSlides(PALESTRA);
else console.log("  - palestra/slides.md não existe; slides pulados");

const manifestos: [string, string][] = [];
if (existsSync(PALESTRA)) {
  for (const f of readdirSync(PALESTRA).filter((f) => f.endsWith(".json")).sort()) {
    manifestos.push([PALESTRA, f.replace(/\.json$/, "")]);
  }
}
manifestos.push([EBOOK, "ebook"]);
for (const [pasta, nome] of manifestos) {
  if (existsSync(join(pasta, `${nome}.json`))) gerarDocumento(pasta, nome);
  else console.log(`  - ${relative(RAIZ, join(pasta, `${nome}.json`))} não existe; pulado`);
}

async function gerarSlides(pasta: string) {
  const entrada = join(pasta, "slides.md");
  // HTML: template bespoke (padrão do Marp CLI), que mostra os fragmentos (`*`, `1)` e
  // `data-marpit-fragment`) um por clique. PDF e PPTX saem com tudo visível.
  for (const formato of ["html", "pdf", "pptx"] as const) {
    const saida = join(pasta, `apresentacao.${formato}`);
    const status = await marpCli([
      entrada,
      ...(formato === "html" ? ["--template", "bespoke", "--bespoke.progress"] : [`--${formato}`]),
      "--theme-set",
      TEMA_SLIDES,
      "--html",
      "--allow-local-files",
      "--quiet",
      "--no-config-file",
      "-o",
      saida,
    ]);
    if (status !== 0) throw new Error(`Marp falhou ao gerar ${saida}`);
    console.log(`  ✔ ${relative(RAIZ, saida)}`);
  }
}

function gerarDocumento(pasta: string, nome: string) {
  const config: ConfigApostila = JSON.parse(readFileSync(join(pasta, `${nome}.json`), "utf8"));

  const capitulos = config.fontes.map((fonte, i) => {
    const caminho = join(RAIZ, fonte.arquivo);
    const markdown = readFileSync(caminho, "utf8");
    const trecho = fonte.secoes
      ? fonte.secoes.map((s) => extrairSecao(markdown, s, fonte.arquivo)).join("\n\n")
      : semTitulo(markdown);
    const html = criarMarked(fonte.arquivo).parse(trecho) as string;
    return { id: `cap-${i + 1}`, titulo: fonte.titulo, html };
  });

  // REPO_URL é a base dos links de arquivo (ex.: https://github.com/<dono>/<repo>/blob/main); na capa
  // vai só a raiz do repo, então um sufixo /blob/<branch> é tirado se existir.
  const documento = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(config.titulo)}</title>
<style>${readFileSync(CSS_APOSTILA, "utf8")}</style></head>
<body>
<section class="capa">
  <p class="selo">Como medir os seus agentes de IA · ${esc(config.selo ?? "Apostila")}</p>
  <h1>${esc(config.titulo)}</h1>
  <p class="subtitulo">${esc(config.subtitulo)}</p>
  <nav><ol>${capitulos.map((c) => `<li><a href="#${c.id}">${esc(c.titulo)}</a></li>`).join("")}</ol></nav>
  ${REPO_URL ? `<p class="rodape">Fonte: ${esc(REPO_URL.replace(/\/blob\/[^/]+$/, ""))}</p>` : ""}
</section>
${capitulos.map((c) => `<section class="capitulo" id="${c.id}"><h1>${esc(c.titulo)}</h1>${c.html}</section>`).join("\n")}
</body></html>`;

  const html = join(mkdtempSync(join(tmpdir(), "material-")), `${nome}.html`);
  writeFileSync(html, documento);
  const saida = join(pasta, `${nome}.pdf`);
  imprimirPdf(html, saida);
  console.log(`  ✔ ${relative(RAIZ, saida)}`);
}

/** Links relativos viram links do GitHub (REPO_URL) ou texto simples quando REPO_URL está vazio. */
function criarMarked(arquivo: string) {
  return new Marked({
    gfm: true,
    walkTokens(token) {
      if (token.type !== "link" && token.type !== "image") return;
      if (/^(https?:|mailto:|#)/.test(token.href)) return;
      if (REPO_URL) {
        const alvo = relative(RAIZ, resolve(RAIZ, dirname(arquivo), token.href.split("#")[0]!));
        token.href = `${REPO_URL}/${alvo}`;
        return;
      }
      const t = token as unknown as { type: string; text: string; tokens?: unknown[] };
      t.type = "text";
    },
  });
}

function semTitulo(markdown: string): string {
  return markdown.replace(/^# .*\n/, "");
}

function extrairSecao(markdown: string, titulo: string, arquivo: string): string {
  const linhas = markdown.split("\n");
  const inicio = linhas.findIndex((l) => /^#{1,6} /.test(l) && l.replace(/^#+ /, "").trim() === titulo);
  if (inicio === -1) throw new Error(`Seção "${titulo}" não encontrada em ${arquivo}`);
  const nivel = linhas[inicio]!.match(/^#+/)![0].length;
  let fim = linhas.length;
  let emCodigo = false;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (linhas[i]!.startsWith("```")) emCodigo = !emCodigo;
    const m = !emCodigo && linhas[i]!.match(/^(#+) /);
    if (m && m[1]!.length <= nivel) {
      fim = i;
      break;
    }
  }
  // A seção vira subtítulo (##) dentro do capítulo, qualquer que fosse o nível original.
  return ["## " + titulo, ...linhas.slice(inicio + 1, fim)].join("\n");
}

function imprimirPdf(html: string, saida: string) {
  const navegador = encontrarNavegador();
  const r = spawnSync(
    navegador,
    ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${saida}`, pathToFileURL(html).href],
    { encoding: "utf8" },
  );
  if (r.status !== 0 || !existsSync(saida)) throw new Error(`Falha ao imprimir o PDF:\n${r.stderr}`);
}

function encontrarNavegador(): string {
  const candidatos = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter((c): c is string => Boolean(c));
  const achado = candidatos.find((c) => existsSync(c));
  if (!achado) throw new Error("Nenhum Chrome/Edge/Chromium encontrado. Defina CHROME_PATH.");
  return achado;
}
