# Glossário

Na coluna da esquerda, o nome que a palestra usa. No meio, o termo técnico, que é o que você vai achar nos livros, na documentação e no buscador. À direita, uma frase.

## O que se mede

| Na palestra | Termo técnico | Em uma frase |
|---|---|---|
| eval | eval, *evaluation* | Tarefas com critério de "deu certo" conferido por código, repetidas, para comparar antes × depois de uma mudança. |
| deu certo | sucesso, critério de feito | A regra objetiva que diz se a tarefa foi resolvida; aqui, o teste escondido passar. |
| teste escondido | teste oculto, *hidden test* | O teste automático que confere a tarefa e que o agente nunca vê: o gabarito da prova. |
| voltas | turnos, *turns* | Cada ida e volta entre o modelo e uma ferramenta (ler, editar, rodar os testes). |
| mexeu onde não devia | fora do escopo | Alterou um arquivo que a tarefa não permitia; não conta como sucesso, mesmo que o teste passe. |
| resolve sempre? | consistência, pass^k | Quantas tarefas deram certo em todas as k tentativas. |
| acertou ao menos uma vez | pass@k | A tarefa deu certo em pelo menos uma de k tentativas; útil quando uma pessoa escolhe a melhor. |
| erro do agente | `erro_agente` | O agente nem terminou (internet, login, limite); fica fora da conta da taxa. |
| desfecho | desfecho, rótulo de resultado | O rótulo único de cada execução: `passou`, `falhou`, `fora_do_escopo` ou `erro_agente`. |
| IA como juiz | LLM-as-judge | Um modelo de IA dá nota ao trabalho de outro; ajuda onde não há teste, mas também varia. |

## Como se lê o resultado

| Na palestra | Termo técnico | Em uma frase |
|---|---|---|
| margem de erro | intervalo de confiança (aqui, intervalo de Wilson, 95%) | A faixa onde a taxa real provavelmente está, como na pesquisa eleitoral. |
| as faixas se cruzam | sobreposição de intervalos | Ainda não dá para dizer quem é melhor. |
| ainda não dá para saber | inconclusivo | Não há dado suficiente para dizer; não é o mesmo que empate. |
| quantas execuções para saber | tamanho de amostra | Quantas execuções de cada lado seriam precisas para as faixas se separarem. |
| o piso | teste z de duas proporções, poder estatístico | Uma estimativa clássica, menos exigente, de quantas execuções seriam precisas. |
| o valor do meio | mediana | O valor do meio quando tudo está em ordem; não é puxado por casos extremos como a média. |
| portão | *quality gate* | Uma checagem que quebra o build quando o resultado piora de forma clara. |

## O experimento e as ferramentas

| Na palestra | Termo técnico | Em uma frase |
|---|---|---|
| agente de código | *coding agent* | Um programa que usa um modelo de IA para ler, editar e testar código, decidindo o próximo passo sozinho. |
| o agente não faz a mesma coisa duas vezes | não determinístico | Mesmo pedido, resultados diferentes; por isso uma execução é uma amostra. |
| pedacinho de texto | token | A unidade de texto que o modelo lê e escreve; é a medida de consumo. |
| regra da casa | convenção | Um combinado do projeto que não dá para adivinhar só lendo o código. |
| o arquivo com as regras da casa | `CLAUDE.md` | Texto que o Claude Code lê no começo de toda conversa; é contexto, não obrigação. |
| o que o modelo tem à frente | contexto | Todo o texto que o modelo leva em conta ao responder: o pedido, os arquivos lidos, as instruções. |
| manual que ele abre se precisar | skill | Instruções sobre um assunto que o agente só carrega quando a tarefa pede. |
| script que roda a cada ação | hook | Código seu que roda antes ou depois de cada ação do agente e pode bloqueá-la. |
| variante A / variante B | grupo de controle / tratamento, teste A/B | As duas versões comparadas: o antes e o depois de uma mudança. |
| tarefa de controle | controle | Tarefa que não depende da mudança; se B ganhar nela também, desconfie. |
| caixa fechada | sandbox | Isolamento imposto pelo sistema: o agente só escreve na cópia e não tem internet. |
| sem tela | headless, `claude -p` | O agente roda sem interface interativa, recebe o pedido por argumento e devolve JSON. |
| conectores da conta | MCP, *Model Context Protocol* | O protocolo que liga o agente a ferramentas externas. |
| quem roda as execuções | promptfoo | Ferramenta de código aberto que repete os casos, roda em paralelo e grava o resultado. |
| ferramenta de testes | Vitest | O executor de testes automáticos usado no app de exemplo e na correção. |
| padrão de texto | regex, expressão regular | Uma forma compacta de descrever um padrão, como "só MAIÚSCULAS e sublinhado". |
| padrão de caminho | glob | Um caminho com curinga: `*` dentro de uma pasta, `**` também nas subpastas. |
| roda a cada push | CI, integração contínua | O processo que roda os testes automaticamente a cada push ou PR. |
| pedido de trabalho | issue | A descrição de uma tarefa, como se abre no GitHub ou no Jira. |
