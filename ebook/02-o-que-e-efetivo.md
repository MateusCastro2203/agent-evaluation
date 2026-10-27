# O que é "efetivo"

"O agente está bom?" não tem resposta enquanto "bom" não estiver definido. Para um agente de código, "bom" são seis números, não um.

## As seis métricas

| Métrica | Pergunta | Como o repo mede |
|---|---|---|
| **Sucesso** | resolveu? | o teste escondido da tarefa passou (critério de feito) |
| Custo / tokens | quanto gastou? | `usage` e `total_cost_usd` do JSON do `claude -p` |
| Turnos | quantas voltas deu? | `num_turns` |
| Tempo | quanto demorou? | `duration_ms` |
| **Fora do escopo** | mexeu onde não devia? | arquivos alterados fora da lista `permitidos` da tarefa |
| **Consistência** | resolve **sempre**? | pass^k: a tarefa passou em todas as repetições |

Algumas definições, para quem está começando:

- **Critério de feito:** a regra objetiva que diz se a tarefa foi resolvida. Aqui é sempre um teste automatizado que o agente não vê (capítulo 3).
- **Turno:** aproximadamente uma ida e volta entre o modelo e uma ferramenta: ler um arquivo, editar, rodar os testes. Mais turnos costumam significar mais tokens e mais tempo.
- **Token:** o pedaço de texto que o modelo lê ou escreve. É a unidade de consumo; tokens de entrada, de saída e de cache são contados separados.

### Por que sucesso sozinho engana

Dois agentes com a mesma taxa de sucesso podem ser muito diferentes. Um pode gastar o dobro de turnos. Outro pode resolver a tarefa editando um arquivo congelado. Se você só olhar a taxa, os dois parecem iguais.

Por isso **fora do escopo** é uma métrica separada, de propósito. "Resolveu, mas editou o código legado que ninguém podia tocar" não é sucesso: em um time de verdade, esse PR volta na revisão.

### Custo em US$: leia como esforço

O `claude -p --output-format json` devolve um campo `total_cost_usd`. A documentação do Claude Code ("Run Claude Code programmatically") avisa que esse valor é uma **estimativa do lado do cliente**. Se você usa assinatura, ele não é fatura: leia como "tamanho do esforço" da execução e compare entre variantes, não como dinheiro gasto.

## Desfecho, não "funcionou?"

Cada execução do repositório termina com **um** rótulo:

| Desfecho | Quando |
|---|---|
| `passou` | o teste escondido passou e nada foi alterado fora do escopo |
| `falhou` | o teste escondido falhou |
| `fora_do_escopo` | algum arquivo alterado não está em `permitidos` (mesmo que o teste passe) |
| `erro_agente` | o agente nem terminou (timeout, login expirado, limite de turnos, saída inválida) ou as dependências que rodam o teste foram adulteradas |

A ordem de decisão é: primeiro `erro_agente`, depois `fora_do_escopo`, depois `passou` ou `falhou` pelo teste.

O ponto mais importante é o último rótulo. **Erro do agente é contado à parte**, fora da taxa de sucesso. Se a sua rede caiu no meio do run, isso não diz nada sobre o `CLAUDE.md`. Se você contasse como falha, a variante que teve o azar de rodar durante a queda pareceria pior. O relatório mostra quantos `erro_agente` cada variante teve, e você decide se o run vale ou se precisa rodar de novo.

Essa ideia vem direto do caso real do capítulo 7: sem rótulo explícito, "funcionou?" vira discussão.

## pass@k × pass^k

Com várias repetições por tarefa, aparecem duas maneiras de resumir:

- **pass@k:** a tarefa passou em **pelo menos uma** de k tentativas.
- **pass^k:** a tarefa passou em **todas** as k tentativas.

Quando k cresce, pass@k sobe (mais chances de acertar uma vez) e pass^k desce (mais chances de errar uma vez). pass@k faz sentido quando um humano olha as tentativas e escolhe a melhor. Para um agente que trabalha sozinho, você não vai pedir de novo até dar certo: o que importa é se ele acerta **sempre**. Por isso o relatório mostra pass^k.

A métrica pass^k foi proposta no τ-bench (Yao et al., 2024), e o post da Anthropic "Demystifying evals for AI agents" (2026) usa a mesma definição: a chance de **todas** as k tentativas darem certo.

No run da palestra, k = 2: o relatório diz quantas das 8 tarefas passaram nas duas repetições, por variante.
