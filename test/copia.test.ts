import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  apagarCopia,
  arquivosAlterados,
  BASE_COPIAS,
  DEPS,
  gitDaCopia,
  prepararCopia,
  rodarTesteOculto,
} from "../src/copia.js";
import { carregarTarefas } from "../src/tarefas.js";
import { aplicarSolucao } from "../src/copia.js";
import { leituraRestrita, resolverPnpmHome, SRT_CLI, validarPrefixoNode } from "../src/caminhos.js";

const RAIZ = join(import.meta.dirname, "..");
const pastas: string[] = [];

async function copia(variante: "a" | "b") {
  const pasta = await prepararCopia(variante);
  pastas.push(pasta);
  return pasta;
}

afterEach(async () => {
  await Promise.all(pastas.splice(0).map((p) => apagarCopia(p)));
});

describe("prepararCopia", () => {
  it("variante A não tem CLAUDE.md", async () => {
    const pasta = await copia("a");
    expect(existsSync(join(pasta, "src", "inscricoes.ts"))).toBe(true);
    expect(existsSync(join(pasta, "CLAUDE.md"))).toBe(false);
  });

  it("variante B tem o CLAUDE.md da variante, com o mesmo conteúdo", async () => {
    const pasta = await copia("b");
    expect(readFileSync(join(pasta, "CLAUDE.md"), "utf8")).toBe(
      readFileSync(join(RAIZ, "variantes", "b", "CLAUDE.md"), "utf8"),
    );
  });

  it("node_modules da cópia liga cada pacote às deps do lab, que são só leitura", async () => {
    const pasta = await copia("a");
    expect(lstatSync(join(pasta, "node_modules")).isDirectory()).toBe(true);
    expect(lstatSync(join(pasta, "node_modules", "vitest")).isSymbolicLink()).toBe(true);
    expect(realpathSync(join(pasta, "node_modules", "vitest"))).toBe(realpathSync(join(DEPS, "node_modules", "vitest")));
    expect(() => writeFileSync(join(DEPS, "node_modules", "vitest", "x"), "x")).toThrow(/EACCES|EPERM/);
  });

  it("cópias ficam fora do $TMPDIR (o sandbox deixa escrever lá)", async () => {
    const pasta = await copia("a");
    expect(pasta.startsWith(BASE_COPIAS)).toBe(true);
    expect(pasta.startsWith(realpathSync(tmpdir()))).toBe(false);
  });

  it("a cópia não tem .git: o git do estado inicial fica fora dela, e apagarCopia leva os dois", async () => {
    const pasta = await prepararCopia("a");
    expect(existsSync(join(pasta, ".git"))).toBe(false);
    expect(existsSync(join(gitDaCopia(pasta), "HEAD"))).toBe(true);
    expect(gitDaCopia(pasta).startsWith(pasta + "/")).toBe(false);
    await apagarCopia(pasta);
    expect(existsSync(pasta)).toBe(false);
    expect(existsSync(gitDaCopia(pasta))).toBe(false);
  });

  it("cópia nova não tem arquivo alterado (nem na B)", async () => {
    expect(await arquivosAlterados(await copia("a"))).toEqual([]);
    expect(await arquivosAlterados(await copia("b"))).toEqual([]);
  });
});

describe("arquivosAlterados", () => {
  it("rodar `pnpm test` na cópia (como o CLAUDE.md manda) não conta como alteração", async () => {
    const pasta = await copia("b");
    const { execFileSync } = await import("node:child_process");
    execFileSync("pnpm", ["test"], { cwd: pasta, stdio: "pipe", env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("VITEST"))) });
    expect(await arquivosAlterados(pasta)).toEqual([]);
  }, 60_000);

  it("lista alterados, novos e apagados, mas não o teste oculto", async () => {
    const pasta = await copia("a");
    writeFileSync(join(pasta, "src", "eventos.ts"), "// mudou\n");
    writeFileSync(join(pasta, "src", "novo.ts"), "export {};\n");
    await rm(join(pasta, "src", "importacao.ts"));
    writeFileSync(join(pasta, "test", "oculto.test.ts"), "// oculto\n");
    expect(await arquivosAlterados(pasta)).toEqual([
      "src/eventos.ts",
      "src/importacao.ts",
      "src/novo.ts",
    ]);
  });

  it("git do host não roda filtro, driver de diff nem fsmonitor plantados pelo agente", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    const fora = await mkdtemp(join(tmpdir(), "medindo-sentinela-"));
    try {
      const marca = (n: string) => join(fora, n);
      const script = (n: string) => {
        const f = join(fora, `${n}.sh`);
        writeFileSync(f, `#!/bin/sh\ntouch ${marca(n)}\nexit 1\n`, { mode: 0o755 });
        return f;
      };
      // config num .git da cópia (o lugar que o git usaria se descobrisse o repo pela cópia)
      mkdirSync(join(pasta, ".git"));
      writeFileSync(
        join(pasta, ".git", "config"),
        `[filter "x"]\n\tclean = ${script("clean")}\n\tsmudge = ${script("smudge")}\n\tprocess = ${script("process")}\n` +
          `[diff "x"]\n\tcommand = ${script("diff")}\n\ttextconv = ${script("textconv")}\n` +
          `[core]\n\tfsmonitor = ${script("fsmonitor")}\n\thooksPath = ${fora}\n`,
      );
      writeFileSync(join(pasta, ".gitattributes"), "* filter=x diff=x\n");
      writeFileSync(join(pasta, "src", "eventos.ts"), "// mudou\n");
      expect(await arquivosAlterados(pasta)).toEqual([".gitattributes", "src/eventos.ts"]);
      await rodarTesteOculto(pasta, tarefa!);
      expect(readdirSync(fora).filter((f) => !f.endsWith(".sh"))).toEqual([]);
    } finally {
      await rm(fora, { recursive: true, force: true });
    }
  }, 60_000);

  it(".gitignore da cópia não esconde arquivo novo", async () => {
    const pasta = await copia("a");
    writeFileSync(join(pasta, ".gitignore"), "src/legado/\n*.secreto\n");
    writeFileSync(join(pasta, "src", "legado", "novo.ts"), "export {};\n");
    writeFileSync(join(pasta, "src", "x.secreto"), "x");
    expect(await arquivosAlterados(pasta)).toEqual([".gitignore", "src/legado/novo.ts", "src/x.secreto"]);
  });

  it("um .git plantado na cópia (link ou arquivo gitdir:) não desvia o git do host", async () => {
    const pasta = await copia("a");
    const outro = await mkdtemp(join(tmpdir(), "medindo-outro-repo-"));
    try {
      const { execFileSync } = await import("node:child_process");
      const g = (...a: string[]) => execFileSync("git", ["-c", "user.name=x", "-c", "user.email=x@x", ...a], { cwd: outro });
      writeFileSync(join(outro, "f.txt"), "f\n");
      g("init", "-q");
      g("add", "-A");
      g("commit", "-qm", "outro");
      const antes = readFileSync(join(outro, ".git", "index"));
      await symlink(join(outro, ".git"), join(pasta, ".git"));
      writeFileSync(join(pasta, "src", "eventos.ts"), "// mudou\n");
      expect(await arquivosAlterados(pasta)).toEqual(["src/eventos.ts"]);
      await rm(join(pasta, ".git"));
      writeFileSync(join(pasta, ".git"), `gitdir: ${join(outro, ".git")}\n`);
      expect(await arquivosAlterados(pasta)).toEqual(["src/eventos.ts"]);
      expect(readFileSync(join(outro, ".git", "index"))).toEqual(antes);
    } finally {
      await rm(outro, { recursive: true, force: true });
    }
  });
});

describe("rodarTesteOculto", () => {
  it("ignora vitest.config.ts e setup criados pelo agente na cópia", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas(); // 01 sem resolver: o teste oculto tem que falhar
    writeFileSync(
      join(pasta, "vitest.config.ts"),
      'export default { test: { include: ["test/nada/**"], exclude: ["**"], passWithNoTests: true, setupFiles: ["test/setup.ts"] } };\n',
    );
    writeFileSync(
      join(pasta, "test", "setup.ts"),
      'import { vi } from "vitest";\nvi.mock("../src/eventos.js", async (orig) => ({ ...(await orig<object>()), listarProximos: () => [] }));\nprocess.exit(0);\n',
    );
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(false);
  });

  it("sobrescreve test/oculto.test.ts plantado pelo agente", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    writeFileSync(
      join(pasta, "test", "oculto.test.ts"),
      'import { it } from "vitest";\nit("trapaça", () => {});\n',
    );
    let corrigida = "";
    expect(await rodarTesteOculto(pasta, tarefa!, { manterEm: (p) => (corrigida = p) })).toBe(false);
    try {
      expect(readFileSync(join(corrigida, "test", "oculto.test.ts"), "utf8")).toBe(
        readFileSync(join(tarefa!.pasta, "oculto.test.ts"), "utf8"),
      );
    } finally {
      await rm(dirname(corrigida), { recursive: true, force: true });
    }
  });
});

describe("rodarTesteOculto não segue links plantados", () => {
  const foras: string[] = [];
  afterEach(async () => {
    await Promise.all(foras.splice(0).map((p) => rm(p, { recursive: true, force: true })));
  });
  async function fora() {
    const p = await mkdtemp(join(tmpdir(), "medindo-alvo-"));
    foras.push(p);
    return p;
  }

  it("test/oculto.test.ts → arquivo de fora: não corrige, e o alvo fica intacto", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    const alvo = join(await fora(), "alvo.ts");
    writeFileSync(alvo, "original\n");
    await rm(join(pasta, "test", "oculto.test.ts"), { force: true });
    await symlink(alvo, join(pasta, "test", "oculto.test.ts"));
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(false);
    expect(readFileSync(alvo, "utf8")).toBe("original\n");
  });

  it("arquivo do agente que virou link (mesmo para dentro da cópia): não corrige", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    await aplicarSolucao(pasta, tarefa!);
    const { renameSync } = await import("node:fs");
    renameSync(join(pasta, "src", "eventos.ts"), join(pasta, "src", "solucao.ts"));
    await symlink("solucao.ts", join(pasta, "src", "eventos.ts"));
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(false);
  });

  it("test/ → pasta de fora: não corrige e não escreve lá", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    const dir = await fora();
    await rm(join(pasta, "test"), { recursive: true, force: true });
    await symlink(dir, join(pasta, "test"));
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("node_modules → pasta de fora: a correção usa o nosso, e a pasta de fora fica intacta", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    await aplicarSolucao(pasta, tarefa!);
    const dir = await fora();
    mkdirSync(join(dir, "pacote"));
    writeFileSync(join(dir, "pacote", "x"), "x");
    await rm(join(pasta, "node_modules"), { recursive: true, force: true });
    await symlink(dir, join(pasta, "node_modules"));
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(true);
    expect(readdirSync(dir)).toEqual(["pacote"]);
    expect(readFileSync(join(dir, "pacote", "x"), "utf8")).toBe("x");
  });

  it("test/ apagado pelo agente: a correção roda o oculto mesmo assim", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    await aplicarSolucao(pasta, tarefa!);
    await rm(join(pasta, "test"), { recursive: true, force: true });
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(true);
  });

  it("test/ trocado por um arquivo: não corrige, sem exceção", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    await aplicarSolucao(pasta, tarefa!);
    await rm(join(pasta, "test"), { recursive: true, force: true });
    writeFileSync(join(pasta, "test"), "x");
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(false);
  });

  it("a correção não escreve nada na cópia do agente", async () => {
    const pasta = await copia("a");
    const [tarefa] = carregarTarefas();
    await aplicarSolucao(pasta, tarefa!);
    await rm(join(pasta, "test", "eventos.test.ts"));
    const antes = readdirSync(pasta, { recursive: true }).sort();
    expect(await rodarTesteOculto(pasta, tarefa!)).toBe(true);
    expect(readdirSync(pasta, { recursive: true }).sort()).toEqual(antes);
    expect(existsSync(join(pasta, "test", "oculto.test.ts"))).toBe(false);
  });
});

describe("fora do alcance do sandbox do agente", () => {
  it("com o perfil do agente (leitura restrita, escrita na cópia e no $TMPDIR), o git do host e a correção ficam inacessíveis", async () => {
    const pasta = await copia("a");
    const caixa = await mkdtemp(join(BASE_COPIAS, "correcao-"));
    const cfg = await mkdtemp(join(tmpdir(), "medindo-perfil-"));
    try {
      writeFileSync(join(caixa, "x.txt"), "segredo");
      const alvos = {
        escreverGit: join(gitDaCopia(pasta), "sonda"),
        lerGit: join(gitDaCopia(pasta), "HEAD"),
        escreverCorrecao: join(caixa, "sonda"),
        lerCorrecao: join(caixa, "x.txt"),
        escreverCopia: join(pasta, "sonda.txt"),
      };
      const sonda = join(pasta, "sonda.cjs");
      writeFileSync(
        sonda,
        `const fs = require("fs"); const a = ${JSON.stringify(alvos)}; const r = {};
for (const [n, f] of Object.entries(a)) { try { n.startsWith("ler") ? fs.readFileSync(f) : fs.writeFileSync(f, "x"); r[n] = "OK"; } catch (e) { r[n] = e.code; } }
process.stdout.write(JSON.stringify(r));`,
      );
      const perfil = join(cfg, "srt.json");
      writeFileSync(
        perfil,
        JSON.stringify({
          filesystem: { ...leituraRestrita(pasta), allowWrite: [pasta, realpathSync(tmpdir())], denyWrite: [] },
          network: { allowedDomains: [], deniedDomains: [] },
        }),
      );
      const { execFileSync } = await import("node:child_process");
      const saida = execFileSync(process.execPath, [SRT_CLI, "--settings", perfil, process.execPath, sonda], { cwd: pasta, encoding: "utf8" });
      expect(JSON.parse(saida)).toEqual({
        escreverGit: "EPERM",
        lerGit: "EPERM",
        escreverCorrecao: "EPERM",
        lerCorrecao: "EPERM",
        escreverCopia: "OK",
      });
    } finally {
      await Promise.all([caixa, cfg].map((p) => rm(p, { recursive: true, force: true })));
    }
  }, 30_000);
});

describe("resolverPnpmHome", () => {
  const home = homedir();
  const raiz = join(home, "projetos", "medindo");
  it("usa PNPM_HOME ou ~/Library/pnpm, e recusa o home, a raiz do disco ou o projeto", () => {
    expect(resolverPnpmHome(undefined, home, raiz)).toContain(join("Library", "pnpm"));
    expect(resolverPnpmHome("/opt/pnpm-que-nao-existe", home, raiz)).toBe("/opt/pnpm-que-nao-existe");
    expect(() => resolverPnpmHome(home, home, raiz)).toThrow(/PNPM_HOME.*home/);
    expect(() => resolverPnpmHome("/", home, raiz)).toThrow(/PNPM_HOME/);
    expect(() => resolverPnpmHome(join(home, "projetos"), home, raiz)).toThrow(/projeto/);
  });
});

describe("validarPrefixoNode", () => {
  const home = homedir();
  const raiz = join(home, "projetos", "medindo");
  it("aceita uma instalação em pasta própria", () => {
    expect(validarPrefixoNode(join(home, ".nvm", "versions", "node", "v25"), home, raiz)).toContain(".nvm");
    expect(validarPrefixoNode("/opt/homebrew", home, raiz)).toBe("/opt/homebrew");
  });
  it("recusa o home, um pai dele e uma pasta que contém o projeto", () => {
    expect(() => validarPrefixoNode(home, home, raiz)).toThrow(/home/);
    expect(() => validarPrefixoNode("/", home, raiz)).toThrow(/contém/);
    expect(() => validarPrefixoNode(join(home, "projetos"), home, raiz)).toThrow(/projeto/);
  });
});
