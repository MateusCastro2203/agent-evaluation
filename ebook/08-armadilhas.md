# Armadilhas

Cada armadilha abaixo produz um número que parece certo e não é. Todas são fáceis de cair e difíceis de perceber depois. Você não precisa ter lido os capítulos técnicos para entender: cada uma diz o que acontece, por que engana e como evitar. Os detalhes de como o repositório se protege ficam nos capítulos indicados.

## 1. Uma execução só

**O que acontece:** você roda cada variante uma vez em cada tarefa, B passa em mais tarefas, e você conclui que B é melhor.

**Por que engana:** o agente não faz a mesma coisa duas vezes (capítulo 1). Uma execução que deu certo combina com uma taxa real de 21% a 100%. A diferença entre as variantes pode ser só sorte, como tirar cara na primeira jogada da moeda.

**Como evitar:** repita cada tarefa (o repositório usa 2 repetições), leia a taxa sempre com a margem de erro (intervalo de Wilson) e olhe o "Resolve sempre?" (pass^k). Antes de concluir, veja quantas execuções seriam precisas para saber (capítulo 5).

## 2. Configuração global vazando

**O que acontece:** a variante A deveria rodar sem `CLAUDE.md`, mas o Claude Code carrega a sua configuração pessoal: o seu `~/.claude/CLAUDE.md`, os seus hooks e as suas skills globais (capítulo 6 explica hook e skill).

**Por que engana:** A passa a ter um `CLAUDE.md` escondido. As duas variantes ficam mais parecidas do que você pensa, e a diferença medida encolhe. Pior: o resultado muda de máquina para máquina, conforme a configuração de cada pessoa.

**Como evitar:** restrinja as fontes de configuração ao projeto (o repositório usa `--setting-sources project`), desligue os conectores da sua conta, que chegam pelo MCP, o protocolo que liga o agente a ferramentas externas (`--strict-mcp-config`, que `--setting-sources` não cobre) e **verifique** na sua máquina: numa cópia da variante A, pergunte ao agente que instruções de memória ele recebeu (capítulo 4). Configuração gerenciada pela organização não sai com flag nenhuma; ela chega igual às duas variantes, então não distorce a comparação, mas o resultado não é "configuração zero".

## 3. Teste visível ao agente

**O que acontece:** o teste que define "feito" está no repositório desde o começo, e o agente o lê, ou o edita até passar.

**Por que engana:** é a prova com o gabarito à vista. O agente otimiza para o teste, não para a tarefa. Ele pode escrever código que só satisfaz aquele caso, ou simplesmente mudar a asserção. A taxa sobe sem o agente ficar melhor.

**Como evitar:** o teste escondido só entra na pasta **depois** que o agente termina, sobrescreve qualquer arquivo de mesmo nome e roda com uma configuração da ferramenta de testes (o Vitest) que fica fora da cópia (capítulo 3).

## 4. Tarefa que já passa

**O que acontece:** o teste escondido passa no código intacto, sem o agente fazer nada. Ou o contrário: nem a solução de referência passa.

**Por que engana:** uma tarefa que já passa dá sucesso para as duas variantes; uma tarefa impossível dá falha para as duas. Nos dois casos, a tarefa só dilui a diferença e faz o conjunto parecer maior do que é.

**Como evitar:** verifique toda tarefa automaticamente: ela precisa **falhar** no app intacto e **passar** com a solução de referência. O repositório faz isso para as 8 tarefas, na camada determinística.

## 5. Contar erro de agente como falha

**O que acontece:** a rede caiu, o login expirou ou a execução estourou o limite de turnos, e isso entrou na taxa como "falhou".

**Por que engana:** o erro não diz nada sobre a configuração que você está medindo. É como contar a falta de um aluno doente como nota zero na prova. Se ele se concentrar numa variante (por exemplo, a que rodou durante a queda da rede), essa variante parece pior sem ser.

**Como evitar:** tenha um desfecho próprio (`erro_agente`), tire-o da conta da taxa e mostre a contagem à parte. Se uma variante tiver muitos erros, rode de novo antes de concluir (capítulo 2).

## 6. Comparar mudando duas coisas

**O que acontece:** entre a linha de base e a nova rodada, você mudou o modelo **e** o `CLAUDE.md`. Ou atualizou a versão do Claude Code no meio.

**Por que engana:** se o resultado mudou, você não sabe quem mudou. Uma das mudanças pode ter ajudado muito e a outra, atrapalhado.

**Como evitar:** uma mudança por vez (capítulo 6). Fixe tudo o que não está sendo medido: modelo, versão da ferramenta, tarefas, número de repetições. Commite a configuração junto com o resultado.

## Mais duas, de bônus

**Ler o custo como fatura.** O `total_cost_usd` do Claude Code é uma estimativa do lado do cliente. Com assinatura, use como medida de esforço para comparar variantes, não como o valor que você pagou.

**Tratar "ainda não dá para saber" como empate.** "Ainda não dá para saber" (inconclusivo) quer dizer "não tenho dado para dizer", não "são iguais". As faixas da margem de erro se cruzam; ainda não se separaram. A ação certa é rodar mais, ou aceitar que a diferença, se existe, é pequena demais para valer o esforço (capítulo 5).
