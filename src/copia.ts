import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, cp, lstat, mkdir, mkdtemp, open, readdir, readFile, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { constants, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import {
  BASE_COPIAS,
  DEPS,
  DEPS_CORRETOR,
  DEPS_NODE_MODULES,
  leituraRestrita,
  RAIZ,
  SRT_CLI,
  VERSAO_SRT,
} from "./caminhos.js";
import { aoEncerrar } from "./encerramento.js";
import type { Tarefa } from "./tarefas.js";

export { BASE_COPIAS, DEPS, DEPS_NODE_MODULES, RAIZ };

export type Variante = "a" | "b";

const exec = promisify(execFile);
const LAB = join(RAIZ, "laboratorio");
const OCULTO = "test/oculto.test.ts";
const REF_INICIAL = "refs/medindo/inicial";
const CONFIG_OCULTO = join(import.meta.dirname, "vitest-oculto.config.mjs");
const VITEST_MJS = join(DEPS_NODE_MODULES, "vitest", "vitest.mjs");
const TIMEOUT_CORRECAO_MS = 120_000;
/** Árvore vazia do git (existe em todo repositório): fonte dos atributos, ou seja, nenhum. */
const ARVORE_VAZIA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/**
 * Git do estado inicial: fora da cópia, ao lado dela (`<cópia>.git`, em BASE_COPIAS). O sandbox do
 * agente não lê nem escreve lá (só a própria cópia e o $TMPDIR). A cópia não tem `.git`: um `.git`
 * que o agente crie nela é só um caminho qualquer, e fica fora do escopo.
 */
export const gitDaCopia = (pasta: string): string => `${pasta}.git`;

/** Exclusões do git do host: o que nós montamos ou o `pnpm test` gera na cópia. */
const exclusoes = (pasta: string) => join(gitDaCopia(pasta), "info", "exclude");

/** Env do git do host: sem config do sistema, do usuário ou de variáveis GIT_* herdadas. */
function envGit(): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_ATTR_NOSYSTEM: "1",
  };
}

/**
 * git no host sobre a cópia com o git dir nosso (`--git-dir`, fora da cópia): nada que o agente
 * escreva na cópia vira config. Sem hook, fsmonitor ou diff externo; atributos lidos da árvore vazia
 * (`attr.tree`), não de um `.gitattributes` da cópia; a única config é a do nosso git dir, que não
 * define filtro nem driver de diff (driver indefinido não roda nada).
 */
async function git(pasta: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec(
    "git",
    [
      `--git-dir=${gitDaCopia(pasta)}`,
      `--work-tree=${pasta}`,
      "-c", "user.name=medindo-agentes",
      "-c", "user.email=lab@exemplo.com",
      "-c", "commit.gpgsign=false",
      "-c", "core.hooksPath=/dev/null",
      "-c", "core.fsmonitor=false",
      "-c", "diff.external=",
      "-c", "core.attributesFile=/dev/null",
      "-c", "core.excludesFile=/dev/null",
      "-c", `attr.tree=${ARVORE_VAZIA}`,
      ...args,
    ],
    { cwd: BASE_COPIAS, env: envGit(), maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout;
}

/** Copia o lab (sem o node_modules dele) para `destino`. */
async function copiarLab(destino: string): Promise<void> {
  await cp(LAB, destino, {
    recursive: true,
    filter: (origem) => !origem.slice(LAB.length).split(/[\\/]/).includes("node_modules"),
  });
}

/**
 * Pasta temporária nova com o lab (sem o node_modules dele) e o estado inicial commitado num git
 * dir do host, fora da cópia (`gitDaCopia`). Apague com `apagarCopia`.
 */
export async function prepararCopia(variante: Variante): Promise<string> {
  await prepararDependencias();
  await mkdir(BASE_COPIAS, { recursive: true });
  const pasta = await mkdtemp(join(BASE_COPIAS, `${variante}-`));
  await copiarLab(pasta);
  if (variante === "b") {
    await copyFile(join(RAIZ, "variantes", "b", "CLAUDE.md"), join(pasta, "CLAUDE.md"));
  }
  await montarNodeModules(pasta);
  await git(pasta, "init", "-q", "--template=");
  await mkdir(dirname(exclusoes(pasta)), { recursive: true });
  // node_modules é montado por nós; `pnpm test` cria o lockfile na cópia
  await writeFile(exclusoes(pasta), "/node_modules\n/pnpm-lock.yaml\n");
  await git(pasta, "add", "-A");
  await git(pasta, "commit", "-qm", "estado inicial");
  await git(pasta, "update-ref", REF_INICIAL, "HEAD");
  return pasta;
}

/** Apaga a cópia e o git dir dela. */
export async function apagarCopia(pasta: string): Promise<void> {
  await Promise.all([pasta, gitDaCopia(pasta)].map((p) => rm(p, { recursive: true, force: true })));
}

/** `apagarCopia` síncrono, para os ganchos de encerramento. */
export function apagarCopiaSync(pasta: string): void {
  for (const p of [pasta, gitDaCopia(pasta)]) rmSync(p, { recursive: true, force: true });
}

function envSemVitest(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith("VITEST") && k !== "TEST" && k !== "NODE_ENV"),
  );
}

/** Perfil do sandbox da correção (formato do sandbox-runtime): escreve só na pasta corrigida e num tmp próprio, sem rede. */
export function perfilCorrecao(pasta: string, tmp: string): object {
  return {
    filesystem: { ...leituraRestrita(pasta, [tmp, DEPS_CORRETOR]), allowWrite: [pasta, tmp], denyWrite: [] },
    network: { allowedDomains: [], deniedDomains: [] },
  };
}

/** Para testes: recebe a pasta corrigida, que então não é apagada. */
export interface OpcoesCorrecao {
  manterEm?: (pastaCorrigida: string) => void;
}

/**
 * Corrige numa pasta NOVA que o agente nunca viu (`BASE_COPIAS/correcao-*`, fora do alcance do
 * sandbox dele): o lab intacto + os arquivos que o agente mudou (só arquivos comuns), o
 * node_modules nosso e o que `preparar` puser. Nada é escrito na cópia do agente, então um link
 * plantado ou um processo dele que tenha sobrado não chega à correção.
 * Roda o vitest dentro do sandbox do SO (`srt`): escrita só na pasta corrigida e num tmp próprio,
 * leitura sem o home (fora deps/node), sem rede. Timeout mata o grupo inteiro.
 */
async function corrigir(
  pasta: string,
  preparar: (corrigida: string) => Promise<boolean>,
  argsVitest: (corrigida: string, config: string) => string[],
  opcoes: OpcoesCorrecao = {},
): Promise<boolean> {
  await prepararDependencias();
  await mkdir(BASE_COPIAS, { recursive: true });
  const caixa = await mkdtemp(join(BASE_COPIAS, "correcao-"));
  const corrigida = join(caixa, "lab");
  const tmp = join(caixa, "tmp");
  const cfg = join(caixa, "cfg"); // srt.json: lido pelo srt antes do sandbox; fora do alcance do vitest
  // Ctrl+C no meio: a caixa some junto; com o vitest rodando, `emGrupo` mata o grupo antes de apagar
  const apagarCaixa = () => rmSync(caixa, { recursive: true, force: true });
  let desregistrar = aoEncerrar(apagarCaixa);
  let manter = false;
  try {
    await Promise.all([mkdir(tmp), mkdir(cfg)]);
    if (!(await montarCorrigida(pasta, corrigida))) return false;
    if (!(await preparar(corrigida))) return false;
    await montarNodeModules(corrigida);
    const perfil = join(cfg, "srt.json");
    await writeFile(perfil, JSON.stringify(perfilCorrecao(corrigida, tmp)));
    // no tmp: o vite grava um arquivo ao lado da config para carregá-la
    const config = join(tmp, "vitest-oculto.config.mjs");
    await copyFile(CONFIG_OCULTO, config);
    if (opcoes.manterEm) {
      manter = true;
      opcoes.manterEm(corrigida);
    }
    desregistrar();
    desregistrar = () => {};
    const codigo = await emGrupo(
      process.execPath,
      [SRT_CLI, "--settings", perfil, process.execPath, VITEST_MJS, "run", ...argsVitest(corrigida, config)],
      { cwd: corrigida, env: { ...envSemVitest(), TMPDIR: tmp } },
      TIMEOUT_CORRECAO_MS,
      apagarCaixa,
    );
    return codigo === 0;
  } finally {
    desregistrar();
    if (!manter) await rm(caixa, { recursive: true, force: true });
  }
}

/**
 * Monta a pasta corrigida: lab intacto, depois cada arquivo que o agente mudou (`arquivosAlterados`):
 * apagado → apaga; arquivo comum → copia o conteúdo. Recusa (false) link, pasta, FIFO, dispositivo,
 * `.git` e caminho com pasta-link no meio.
 */
async function montarCorrigida(pasta: string, corrigida: string): Promise<boolean> {
  await copiarLab(corrigida);
  const raiz = await realpath(pasta);
  const mudancas: [string, Buffer | "ausente"][] = [];
  for (const rel of await arquivosAlterados(pasta)) {
    const conteudo = await lerArquivoComum(pasta, raiz, rel);
    if (conteudo === "recusado") return false;
    mudancas.push([rel, conteudo]);
  }
  try {
    // apaga tudo antes de escrever: `test/` → arquivo `test` funciona em qualquer ordem
    for (const [rel] of mudancas) await rm(join(corrigida, rel), { recursive: true, force: true }).catch(() => {});
    for (const [rel, conteudo] of mudancas) {
      if (conteudo === "ausente") continue;
      const destino = join(corrigida, rel);
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, conteudo, { flag: "wx" });
    }
  } catch {
    return false; // caminhos que não cabem juntos numa árvore (só com a cópia mudando no meio)
  }
  return true;
}

/**
 * Lê `rel` da cópia sem seguir link: as pastas do caminho têm que ser as de verdade, dentro da
 * cópia; o arquivo é aberto com O_NOFOLLOW e tem que ser comum. Sumiu → "ausente".
 */
async function lerArquivoComum(pasta: string, raiz: string, rel: string): Promise<Buffer | "ausente" | "recusado"> {
  const partes = rel.split("/");
  if (rel.startsWith("/") || partes.some((p) => p === "" || p === "." || p === ".." || p === ".git")) return "recusado";
  const abs = join(pasta, rel);
  const naoExiste = (e: unknown) => ["ENOENT", "ENOTDIR"].includes((e as NodeJS.ErrnoException).code ?? "");
  try {
    if ((await realpath(dirname(abs))) !== join(raiz, dirname(rel))) return "recusado";
  } catch (e) {
    if (naoExiste(e)) return "ausente";
    throw e;
  }
  let fh;
  try {
    fh = await open(abs, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (e) {
    if (naoExiste(e)) return "ausente";
    if ((e as NodeJS.ErrnoException).code === "ELOOP") return "recusado"; // link
    throw e;
  }
  try {
    if (!(await fh.stat()).isFile()) return "recusado";
    return await fh.readFile();
  } finally {
    await fh.close();
  }
}

/**
 * Processo num grupo próprio; devolve o código de saída (null se morreu por timeout ou sinal).
 * Enquanto roda, Ctrl+C/SIGTERM neste processo mata o grupo e depois chama `aoInterromper`.
 */
function emGrupo(
  comando: string,
  args: string[],
  opcoes: { cwd: string; env: NodeJS.ProcessEnv },
  timeoutMs: number,
  aoInterromper: () => void = () => {},
): Promise<number | null> {
  return new Promise((resolve) => {
    const filho = spawn(comando, args, { ...opcoes, stdio: "ignore", detached: true });
    const matar = () => {
      try {
        if (filho.pid !== undefined) process.kill(-filho.pid, "SIGKILL");
      } catch {
        // já acabou
      }
    };
    // Ctrl+C/SIGTERM no meio da correção: o grupo (srt + vitest) morre primeiro, depois a limpeza
    const desregistrar = aoEncerrar(() => {
      matar();
      aoInterromper();
    });
    const relogio = setTimeout(matar, timeoutMs);
    filho.on("error", () => {
      clearTimeout(relogio);
      desregistrar();
      resolve(null);
    });
    filho.on("close", (codigo) => {
      clearTimeout(relogio);
      matar();
      desregistrar();
      resolve(codigo);
    });
  });
}

/**
 * Roda só o teste oculto da tarefa sobre o que o agente mudou, numa pasta corrigida nova (ver
 * `corrigir`), com a config fixa de fora da cópia (vitest/vite config do agente é ignorada). O teste
 * oculto entra por último, por cima de qualquer `test/oculto.test.ts`. Algo recusado → false.
 */
export async function rodarTesteOculto(pasta: string, tarefa: Tarefa, opcoes: OpcoesCorrecao = {}): Promise<boolean> {
  return corrigir(
    pasta,
    async (corrigida) => {
      const destino = join(corrigida, OCULTO);
      try {
        await mkdir(dirname(destino), { recursive: true });
      } catch {
        return false; // o agente trocou `test/` por um arquivo
      }
      await rm(destino, { recursive: true, force: true });
      await copyFile(join(tarefa.pasta, "oculto.test.ts"), destino, constants.COPYFILE_EXCL);
      return true;
    },
    (corrigida, config) => ["--config", config, "--root", corrigida],
    opcoes,
  );
}

/** Roda a suíte inteira (testes visíveis do lab e o que o agente pôs em test/), numa pasta corrigida nova. */
export async function rodarSuiteVisivel(pasta: string): Promise<boolean> {
  return corrigir(pasta, async () => true, () => []);
}

function dentroDe(raiz: string, alvo: string): boolean {
  return alvo === raiz || alvo.startsWith(raiz + sep);
}

/**
 * Entradas que o agente não deveria criar, caminhos relativos à cópia, em ordem: link simbólico que
 * sai da cópia, qualquer `.git` (pasta, arquivo `gitdir:` ou link) e o que não é arquivo nem pasta
 * (FIFO, socket, dispositivo). Pula só o `node_modules` da raiz, que é montado por nós.
 */
export async function entradasSuspeitas(pasta: string): Promise<string[]> {
  const raiz = await realpath(pasta);
  const achados: string[] = [];
  const andar = async (dir: string): Promise<void> => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const abs = join(dir, item.name);
      const rel = relative(pasta, abs);
      if (rel === "node_modules") continue;
      if (item.name === ".git") {
        achados.push(rel);
      } else if (item.isSymbolicLink()) {
        let alvo: string;
        try {
          alvo = await realpath(abs);
        } catch {
          alvo = resolve(dir, await readlink(abs)); // link quebrado: julga pelo texto do alvo
        }
        if (!dentroDe(raiz, alvo)) achados.push(rel);
      } else if (item.isDirectory()) {
        await andar(abs);
      } else if (!item.isFile()) {
        achados.push(rel);
      }
    }
  };
  await andar(pasta);
  return achados.sort();
}

/** Dos `alterados`, os que existem e não são arquivo comum (link, mesmo para dentro, pasta, FIFO…): a correção os recusa. */
export async function naoComuns(pasta: string, alterados: string[]): Promise<string[]> {
  const achados: string[] = [];
  for (const rel of alterados) {
    try {
      if (!(await lstat(join(pasta, rel))).isFile()) achados.push(rel);
    } catch {
      // apagado: ok
    }
  }
  return achados;
}

/**
 * Arquivos que diferem do estado inicial, incluindo novos e apagados; sem o teste oculto. Só com o
 * git do host e as exclusões dele (`.gitignore` da cópia não esconde nada). O git não lista `.git`:
 * esses saem em `entradasSuspeitas`.
 */
export async function arquivosAlterados(pasta: string): Promise<string[]> {
  const nulo = (s: string) => s.split("\0").filter(Boolean);
  const mudados = nulo(await git(pasta, "diff", "--name-only", "--no-renames", "-z", REF_INICIAL));
  const novos = nulo(await git(pasta, "ls-files", "--others", "-z", `--exclude-from=${exclusoes(pasta)}`));
  return [...new Set([...mudados, ...novos])].filter((f) => f !== OCULTO).sort();
}

/** Para testes: aplica a solução de referência da tarefa por cima da cópia. */
export async function aplicarSolucao(pasta: string, tarefa: Tarefa): Promise<void> {
  await cp(join(tarefa.pasta, "solucao"), pasta, { recursive: true, force: true });
}

/**
 * `node_modules` da pasta (cópia ou corrigida): pasta própria (vitest e vite escrevem cache nela) com
 * um link para cada pacote de `.lab-deps`, que é só leitura.
 */
async function montarNodeModules(pasta: string): Promise<void> {
  const nm = join(pasta, "node_modules");
  await rm(nm, { recursive: true, force: true });
  await mkdir(nm);
  for (const nome of await readdir(DEPS_NODE_MODULES)) {
    if (nome.startsWith(".") && nome !== ".bin") continue;
    await symlink(join(DEPS_NODE_MODULES, nome), join(nm, nome), "dir");
  }
}

function versaoNaRaiz(pacote: string): string {
  const json = JSON.parse(readFileSync(join(RAIZ, "node_modules", pacote, "package.json"), "utf8")) as { version: string };
  return json.version;
}

const instalando = new Map<string, Promise<void>>();

/**
 * Instala uma vez `dependencies` em `dir` (layout plano, arquivos copiados, sem hardlink para a
 * store do pnpm), grava o hash da árvore em `.pronto` e tira a permissão de escrita. Instala numa
 * pasta temporária e renomeia, para dois processos ao mesmo tempo não verem meia instalação.
 * Se o `package.json` instalado for de outra lista, reinstala.
 */
function instalarDeps(dir: string, dependencies: Record<string, string>): Promise<void> {
  let p = instalando.get(dir);
  if (!p) {
    p = (async () => {
      const manifesto = JSON.stringify({ name: "deps", private: true, dependencies }, null, 2);
      if (existsSync(join(dir, ".pronto"))) {
        if (readFileSync(join(dir, "package.json"), "utf8") === manifesto) return;
        await exec("chmod", ["-R", "u+w", dir]);
        await rm(dir, { recursive: true, force: true });
      }
      const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
      await mkdir(tmp, { recursive: true });
      await writeFile(join(tmp, "package.json"), manifesto);
      await exec(
        "pnpm",
        [
          "install",
          "--ignore-workspace",
          "--prefer-offline",
          "--config.node-linker=hoisted",
          "--config.package-import-method=copy",
          "--config.lockfile=false",
        ],
        { cwd: tmp, maxBuffer: 10 * 1024 * 1024 },
      );
      await exec("chmod", ["-R", "a-w", join(tmp, "node_modules")]);
      await writeFile(join(tmp, ".pronto"), await hashDependencias(join(tmp, "node_modules")));
      await exec("chmod", ["-R", "a-w", tmp]);
      try {
        await rename(tmp, dir);
      } catch (e) {
        // outro processo ganhou a corrida: fica a dele
        await exec("chmod", ["-R", "u+w", tmp]);
        await rm(tmp, { recursive: true, force: true });
        if (!existsSync(join(dir, ".pronto"))) throw e;
      }
    })();
    instalando.set(dir, p);
  }
  return p;
}

/** Deps do lab (`.lab-deps`) e do corretor (`.corretor-deps`), instaladas uma vez. */
export async function prepararDependencias(): Promise<void> {
  await Promise.all([
    instalarDeps(DEPS, { vitest: versaoNaRaiz("vitest"), "@types/node": versaoNaRaiz("@types/node") }),
    instalarDeps(DEPS_CORRETOR, { "@anthropic-ai/sandbox-runtime": VERSAO_SRT }),
  ]);
}

/**
 * Hash da árvore de deps: conteúdo e permissões de cada arquivo, permissões de cada pasta e alvo de
 * cada link, em ordem. As permissões entram porque um `chmod u+w` é o primeiro passo de uma adulteração.
 */
export async function hashDependencias(raiz: string = DEPS_NODE_MODULES): Promise<string> {
  const h = createHash("sha256");
  const modo = async (abs: string) => ((await lstat(abs)).mode & 0o7777).toString(8);
  const andar = async (dir: string, rel: string): Promise<void> => {
    h.update(`D${rel}\0${await modo(dir)}\0`);
    const itens = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const item of itens) {
      const abs = join(dir, item.name);
      const r = `${rel}/${item.name}`;
      if (item.isSymbolicLink()) h.update(`L${r}\0${await readlink(abs)}\0`);
      else if (item.isDirectory()) await andar(abs, r);
      else h.update(`F${r}\0${await modo(abs)}\0`).update(await readFile(abs)).update("\0");
    }
  };
  await andar(raiz, "");
  return h.digest("hex");
}

const hashesInstalados = new Map<string, Promise<string>>();

async function intacta(dir: string): Promise<boolean> {
  let esperado = hashesInstalados.get(dir);
  if (!esperado) {
    esperado = readFile(join(dir, ".pronto"), "utf8");
    hashesInstalados.set(dir, esperado);
  }
  const [e, atual] = await Promise.all([esperado, hashDependencias(join(dir, "node_modules"))]);
  return e === atual;
}

/** Deps do lab e do corretor intactas? Cada árvore tem o hash gravado na instalação (lido uma vez por processo). */
export async function dependenciasIntactas(): Promise<boolean> {
  await prepararDependencias();
  const [lab, corretor] = await Promise.all([intacta(DEPS), intacta(DEPS_CORRETOR)]);
  return lab && corretor;
}
