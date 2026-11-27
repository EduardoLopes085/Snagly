# Roadmap do Snagly

O objetivo é transformar o Snagly em uma extensão que as pessoas consigam instalar,
entender e usar repetidamente para salvar vídeos e áudio das redes suportadas.
A prioridade inicial é concluir downloads corretos com poucos passos, oferecer
recuperação quando algo falhar e comunicar a cobertura de cada plataforma.

Este planejamento considera um mantenedor principal e contribuições por PR.
A ordem e os critérios abaixo são propostas de trabalho. As metas de desempenho
devem ser calibradas com medições antes de virarem bloqueios de release.

## Base atual

O código já oferece menu de contexto, janela com prévia, versões MP4 agrupadas
no X, conversão local para MP3 e entrega ao gerenciador de downloads do navegador.
Há extratores de X, Instagram e Facebook, consulta aos metadados do Instagram,
diagnóstico de busca e configurações de CI e empacotamento de releases.

A conversão MP3 atual decodifica o áudio em memória e aceita entradas de até
64 MB e duração de até dez minutos. O suporte aos sites depende das fontes
progressivas disponíveis. Instalação pelas lojas, testes completos de navegador
no CI, união de faixas e retomada persistente precisam evoluir.

## Experiência que queremos entregar

Uma pessoa instala a extensão, abre uma publicação, aciona **Baixar com Snagly**
e reconhece o vídeo pela prévia. Ela vê as opções disponíveis, escolhe um formato
e acompanha o arquivo pelo navegador. Quando o download exige conversão, ela
entende o progresso, pode cancelar e recebe uma mensagem que explica como agir
se houver falha.

Os primeiros fluxos a validar são salvar uma publicação individual, obter o áudio
de um vídeo e abrir uma publicação pública compartilhada por DM. A utilidade
desses fluxos será conferida com usuários durante a beta.

## Sequência de entregas

| Etapa | Resultado para quem usa | Prioridade |
| --- | --- | --- |
| 1. Confiabilidade | O vídeo escolhido é encontrado e o arquivo correto é entregue | P0 |
| 2. Uso diário | Opções claras, preferências e recuperação de erros | P0 |
| 3. Beta pública | Instalação simples, documentação e canal de feedback | P0 |
| 4. Cobertura de mídia | Mais publicações com vídeo e áudio completos | P1 |
| 5. Trabalhos duradouros | Conversões independentes da janela e fila controlada | P1 |
| 6. Desempenho e expansão | Consumo medido, otimizações e novas coberturas comprovadas | P2 |

P0 prepara a primeira beta utilizável. P1 amplia o uso recorrente. P2 é
priorizado conforme os problemas observados na beta. Melhorias de segurança
e correções de regressões acompanham todas as etapas.

## Etapa 1 Confiabilidade dos fluxos principais

### Entregas

- [ ] Criar uma matriz de casos por rede, navegador e caminho de navegação.
  Incluir feed, publicação individual, Reels, Explorar, links públicos pela DM,
  carrosséis e navegação interna sem F5.
- [ ] Levar os testes da extensão para o CI, começando pelo Chromium.
  Exercitar a janela real, a seleção de opções, o background e o download final.
- [ ] Adicionar testes de integração específicos de Firefox antes de anunciar
  equivalência de cobertura.
- [ ] Registrar regressões com fixtures autorizadas e dados de teste. Incluir
  player montado com atraso, URLs expiradas, vídeos vizinhos, áudio ausente
  e falha de rede.
- [ ] Preservar a identidade do conteúdo clicado durante navegação, carrosséis
  e substituição do player. Agrupar resoluções por mídia nas três plataformas.
- [ ] Validar o conteúdo do arquivo final, a duração e as faixas de áudio e vídeo.
  Conferir também cancelamento e interrupção.
- [ ] Distinguir publicação ainda carregando, acesso necessário, fonte expirada,
  formato indisponível e erro de transferência nas mensagens.
- [ ] Testar permissões negadas e revogadas, redirecionamentos, domínios indevidos
  e isolamento entre o conteúdo escolhido e publicações vizinhas.

### Critérios propostos de conclusão

Todos os cenários anunciados como suportados passam pela matriz correspondente.
O teste confere o arquivo depois do fechamento da janela. Casos ambíguos pedem
uma seleção explícita. Falhas de transferência preservam uma forma de tentar
novamente e têm uma mensagem específica.

Os testes determinísticos entram no CI. Uma lista pequena de publicações
autorizadas complementa a validação manual antes de releases.

## Etapa 2 Uma experiência simples de uso diário

### Novas funções

- [ ] Adicionar uma tela de preferências com formato, resolução preferida,
  qualidade de áudio e comportamento de fechamento.
- [ ] Permitir baixar novamente usando a última preferência, com um gesto
  explícito do usuário e indicação da qualidade escolhida.
- [ ] Melhorar a identificação dos cartões com miniatura, duração, resolução,
  presença de áudio e plataforma, quando esses dados estiverem disponíveis.
- [ ] Oferecer nomes de arquivo legíveis e seguros, com opção de incluir
  plataforma, data e identificação da publicação.
- [ ] Mostrar tamanho exato quando conhecido ou uma estimativa identificada
  como tal, obtida com custo de rede limitado.
- [ ] Acrescentar progresso por etapa na conversão e um botão de cancelamento.
- [ ] Oferecer repetição da busca e renovação da fonte quando uma URL expirar.

### Melhorias de interface

- [ ] Concluir a localização de todos os textos em português e inglês.
- [ ] Validar navegação por teclado, foco, leitor de tela, contraste e zoom.
- [ ] Adaptar a janela a telas pequenas e temas claro, escuro e do sistema.
- [ ] Explicar permissões no momento da ação e oferecer recuperação após uma
  negativa ou revogação.
- [ ] Criar uma introdução curta na primeira instalação com um exemplo de uso.
- [ ] Manter diagnósticos copiáveis com revisão e remoção de dados sensíveis.

### Critérios propostos de conclusão

Uma rodada com cinco a dez pessoas consegue instalar a extensão, identificar
a mídia e concluir um download seguindo a orientação inicial. Registrar onde
elas hesitam, quais mensagens confundem e quais preferências realmente usam.
Corrigir os obstáculos recorrentes antes da beta.

## Etapa 3 Beta pública e distribuição

### Preparação

- [ ] Publicar uma matriz de compatibilidade com navegador, versão, sistema
  testado e fluxos confirmados por rede.
- [ ] Preparar ícones, capturas reais, descrição das lojas e um vídeo curto
  demonstrando o fluxo completo.
- [ ] Escrever uma política de privacidade coerente com requisições, permissões,
  dados temporários e uso da sessão das plataformas.
- [ ] Revisar avisos, fontes e obrigações das dependências incluídas nos pacotes.
- [ ] Validar uma instalação limpa e uma atualização sobre a versão anterior.
- [ ] Ativar manualmente os canais de segurança e conferir as regras de PR
  e as permissões do Actions.
- [ ] Adicionar análise de segurança do código e revisar os parsers com entradas
  malformadas, tamanhos excessivos e origens indevidas antes da beta.

### Publicação

- [ ] Preparar a submissão e assinatura do Firefox, seguindo a ordem prevista
  no plano técnico.
- [ ] Preparar a submissão à Chrome Web Store e a validação dos navegadores
  Chromium que serão anunciados individualmente.
- [ ] Disponibilizar documentação pública de instalação, permissões e solução
  de problemas, com links diretos às versões distribuídas.
- [ ] Adotar notas de versão com mudanças, correções e limitações conhecidas.
- [ ] Definir como retirar uma versão com defeito e lançar uma correção.
  Ensaiar o procedimento com uma pré-release.

As políticas das lojas exigem atenção às permissões e às declarações de
tratamento de dados. O envio do Firefox também pode exigir fontes e instruções
de build para revisão. Conferir os requisitos vigentes durante a submissão.
[Política de dados da Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/user-data) · [Submissão ao Firefox AMO](https://www.extensionworkshop.com/documentation/publish/submitting-an-add-on/)

### Critérios propostos de conclusão

As pessoas do grupo beta conseguem instalar por um canal distribuído e concluir
os fluxos publicados. Há instruções de suporte, uma versão identificável,
compatibilidade documentada e um procedimento de atualização testado.
As permissões e descrições das lojas correspondem ao pacote enviado.

## Etapa 4 Vídeo e áudio completos em mais publicações

- [ ] Implementar extração de AAC para M4A quando a fonte permitir preservar
  a faixa de áudio, com duração e reprodução verificadas.
- [ ] Implementar HLS VOD progressivamente, começando pelos casos obrigatórios
  da matriz técnica e validando cada formato anunciado.
- [ ] Unir vídeo e áudio separados, com verificação de sincronismo, duração
  e reprodução com busca.
- [ ] Oferecer as qualidades compatíveis disponíveis na fonte e informar
  restrições de codec ou presença de áudio.
- [ ] Ampliar carrosséis com escolha por item e indicação inequívoca do item
  selecionado.
- [ ] Avaliar fotos e imagens de carrosséis após validar a demanda na beta.
  Reutilizar a identificação da publicação e o fluxo de seleção.
- [ ] Estudar DASH para vídeos sob demanda depois de validar o processamento
  e a união das faixas da etapa HLS.

### Dependências e aceite

O motor de segmentos depende de armazenamento temporário, controle de memória,
cancelamento e permissões por origem. Arquivos de teste devem ser reproduzíveis
do início ao fim, manter sincronismo e sobreviver às interrupções previstas.
A matriz técnica detalha os casos de HLS. [Especificação](SPEC.md)

## Etapa 5 Fila e trabalhos independentes da janela

- [ ] Criar uma área de trabalhos com progresso, estado, cancelamento e repetição.
- [ ] Fazer conversões continuarem quando a janela de seleção for fechada,
  validando o hospedeiro de processamento em cada navegador.
- [ ] Implementar uma fila com conversão sequencial por padrão e limite global
  de memória para trabalhos simultâneos.
- [ ] Permitir selecionar os itens desejados de um carrossel e adicioná-los
  à fila com um gesto explícito.
- [ ] Adicionar pausa e retomada onde a origem e o formato suportarem, com
  conferência da identidade do arquivo.
- [ ] Implementar checkpoints para trabalhos longos e recuperação após reinício.
- [ ] Preservar trabalhos recuperáveis e limpar temporários de trabalhos
  concluídos ou cancelados.
- [ ] Mostrar o espaço temporário ocupado e oferecer uma ação para limpeza.
- [ ] Testar falha parcial, falta de espaço, encerramento do navegador e
  exportação repetida sem duplicar arquivos indevidamente.

### Critérios propostos de conclusão

O fechamento da interface preserva os trabalhos ativos compatíveis. Cancelar
interrompe a atividade associada e libera os recursos temporários. A retomada
confere a continuidade da mídia e orienta reinício quando a origem mudou.
O comportamento é validado com arquivos grandes nos navegadores anunciados.

## Etapa 6 Desempenho medido e expansão responsável

### Velocidade e memória

- [ ] Criar cenários reproduzíveis de detecção, MP4 direto, extração de áudio,
  conversão curta, conversão longa e processamento de segmentos.
- [ ] Registrar hardware, navegador, tempo até as opções, tempo de processamento,
  CPU, pico de RAM e tamanho do pacote.
- [ ] Separar o tempo de resposta da plataforma do tempo gasto pelo Snagly.
- [ ] Reduzir leituras repetidas, cópias de buffers e expansão por base64.
  Avaliar transporte e exportação próprios para arquivos grandes.
- [ ] Migrar o processamento de áudio para blocos onde o codec e as APIs
  disponíveis permitirem.
- [ ] Verificar atividade ociosa e comportamento após várias operações seguidas.
- [ ] Avaliar Rust/WASM com um protótipo isolado e comparar com a implementação
  atual usando os mesmos arquivos, qualidade de saída e navegadores.

Metas iniciais para investigação incluem mostrar opções em até 300 ms no p95
quando todos os dados já estiverem carregados localmente e manter a memória de
trânsito dos segmentos limitada independentemente da duração. Esses valores
precisam de uma linha de base e de calibração por navegador.

A adoção de Rust depende do ganho medido, do custo de inicialização, das cópias
de memória, da compatibilidade e do tamanho do pacote. A expansão dos limites
de conversão acompanha os resultados do processamento por blocos.

### Manutenção e confiança

- [ ] Ampliar os testes dos parsers e a análise de segurança conforme novos
  formatos, origens e formas de processamento forem adicionados.
- [ ] Gerar checksums, inventário de dependências e comprovação de origem dos
  pacotes de release.
- [ ] Criar verificações periódicas de amostras públicas autorizadas, com
  frequência limitada e alertas agrupados quando uma plataforma mudar.
- [ ] Facilitar relatórios de falha por ação explícita, com prévia dos dados
  que serão compartilhados.
- [ ] Manter as métricas de teste locais e usar feedback voluntário na beta.
  Uma mudança na coleta de dados exige decisão explícita e revisão da privacidade.
- [ ] Priorizar novos sites e funções conforme pedidos recorrentes e capacidade
  de testar e manter cada integração.

## Como avaliar se o produto está melhorando

| Pergunta | Evidência a acompanhar |
| --- | --- |
| As pessoas concluem a tarefa? | Conclusão dos cenários de teste e sessões voluntárias da beta |
| A mídia corresponde ao que foi escolhido? | Testes de identidade, itens vizinhos, faixas e duração |
| A busca ficou mais rápida? | Tempos local e de rede medidos separadamente |
| O consumo cabe em máquinas comuns? | Pico de RAM e CPU em cenários e equipamentos documentados |
| A pessoa entende uma falha? | Tentativas de recuperação concluídas e feedback das mensagens |
| Vale a pena voltar a usar? | Relatos de uso repetido e necessidades recorrentes do grupo beta |
| Uma release está pronta? | CI, testes de navegador, validação manual e instalação limpa |

## Próxima sequência de implementação

1. Transformar a regressão do Instagram sem F5 em teste de navegador versionado.
2. Cobrir seleção do vídeo correto, download MP4 e conversão MP3 no fluxo completo.
3. Corrigir as mensagens e adicionar cancelamento da conversão.
4. Implementar preferências e identificação mais clara da mídia.
5. Medir a base atual e conduzir uma rodada pequena de testes com usuários.
6. Preparar os pacotes, a privacidade e a primeira beta distribuída.

Essa sequência pode avançar por PRs pequenos, cada um com resultado verificável.
A revisão do roadmap acompanha o feedback da beta e as regressões encontradas.
