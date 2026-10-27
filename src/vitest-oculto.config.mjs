// Config fixa do teste oculto. Fica fora da cópia do lab: o agente não consegue mudar include,
// setupFiles, globalSetup nem plugins. O root vem por --root. Objeto puro, sem import: é copiada
// para uma pasta temporária da correção, que roda em sandbox sem acesso ao projeto.
export default {
  test: {
    include: ["test/oculto.test.ts"],
    exclude: [],
    setupFiles: [],
    globalSetup: [],
    passWithNoTests: false,
    watch: false,
  },
};
