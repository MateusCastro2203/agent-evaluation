import { describe, expect, it } from "vitest";
import { sanitizarCaminhos } from "../src/sanitizar.js";

describe("sanitizarCaminhos", () => {
  it("troca raiz, home e tmp por marcas sem nome de usuário", () => {
    const json = JSON.stringify({
      basePath: "/home/fulana/proj/lab",
      a: "/home/fulana/.claude/x",
      b: "/private/tmp/medindo-agentes/a-1",
    });
    const r = sanitizarCaminhos(json, "/home/fulana/proj/lab", "/home/fulana");
    expect(JSON.parse(r)).toEqual({ basePath: ".", a: "~/.claude/x", b: "<tmp>/medindo-agentes/a-1" });
    expect(r).not.toMatch(/fulana|\/home|\/private/);
  });
});
