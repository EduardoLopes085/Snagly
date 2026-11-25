# Snagly — especificação v0.4

Snagly é uma extensão gratuita para salvar, no dispositivo, mídia que o usuário tem direito de baixar. A primeira versão é uma extensão para desktop. A matriz de suporte começa em Chromium e Firefox com Manifest V3, usando a mesma base em TypeScript. Chrome, Edge, Brave e Opera entram na lista de compatibilidade publicada conforme forem verificados individualmente.

O processamento acontece no navegador, com rede para obter a mídia da fonte. O projeto não opera servidor, conta ou telemetria. Doações serão voluntárias e todos os recursos serão gratuitos. Não haverá cobrança por duração, resolução ou tamanho. O suporte depende dos formatos, recursos e permissões disponíveis no navegador.

## Escopo e entregas

| Marco | Entrega | Aceite |
| --- | --- | --- |
| M0 | WXT, TypeScript, popup em português e inglês e builds MV3 | Manifests de produção conferidos e popup aberto em Chromium e Firefox |
| M1 | Detecção progressiva sob demanda e download nativo | Um arquivo de cada formato aceito, origem de mídia diferente da página e download concluído com o popup fechado. Prova de conceito separada para exportação por OPFS nos dois motores |
| M2 | MVP técnico com HLS VOD | Casos obrigatórios da matriz, entrega por OPFS e teste de interrupção do remux. Desempenho medido no cenário de referência |
| M3–M4 | Extratores progressivos na ordem X/Twitter, Instagram e Facebook | Fixtures anonimizadas e posts públicos de teste autorizados. Falha de um extrator preserva o caminho genérico |
| M5 | Extração de faixa AAC para M4A | Arquivo reproduzível, duração preservada e mensagem clara quando a faixa for incompatível |
| M6 | Fila, pausa, cancelamento e retomada após reinício | Arquivo de 5 GB verificável nos dois motores, retomada sem duplicar o arquivo e tratamento de cota/erro na entrega |
| M7 | Regras embutidas e testes canário | Extrações determinísticas contra fixtures e sinal externo deduplicado quando um canário quebra |
| M8–M9 | Documentação, doações e publicação | Declarações por loja correspondem ao build. Validar Firefox AMO e depois os demais canais comprovados |

### Validação dos extratores progressivos em Windows

| Plataforma | Resultado de 23 de novembro de 2026 |
| --- | --- |
| X/Twitter | O popup detectou versões de 240p e 480p no HTML público de um post, carregado no Chrome for Testing com os scripts da plataforma desativados. O download pelo CDN produziu um MP4 H.264/AAC de 6 s. A navegação direta automatizada no X não confirmou esse fluxo ao vivo. |
| Instagram | O popup baixou um MP4 de 15 s a partir de uma publicação pública em Chrome for Testing e Firefox. A inspeção do arquivo mostrou vídeo H.264 sem faixa de áudio. O popup avisa sobre áudio separado. |
| Facebook | O popup baixou um MP4 H.264/AAC de 74 s a partir de uma publicação pública no Chrome for Testing. A consulta opcional ao player público também retornou fontes MP4 HD e SD. |

Os testes locais cobrem a associação da mídia com o ID da publicação, URLs assinadas, carrosséis, domínios aceitos e a consulta ao player público sem cookies. A aprovação de uma amostra vale para aquele formato e fluxo de publicação.

Download progressivo na primeira versão abrange URLs HTTP(S) de MP4, WebM, M4A e MP3 expostas por elementos de áudio e vídeo. Exemplos futuros de extensão da cobertura incluem mídias sem extensão na URL, elementos em frames e fontes descobertas por observação da rede. Disponibilidade de um arquivo no DOM é uma pista, e a fonte pode recusar o download. 4K é oferecido quando a variante é compatível. Conteúdo com proteção reconhecida pela extensão recebe uma mensagem específica. DRM, serviços de assinatura e YouTube ficam fora do escopo. DASH, lives, codificação para MP3, Rust/WASM e Native Messaging podem ser avaliados depois do MVP.

## Arquitetura e permissões

- WXT gera builds MV3 distintos. O popup usa HTML, CSS e DOM nativos e só existe durante a interação. A análise roda sob demanda na aba ativa. No X, se o mundo isolado não encontrar as variantes, a extensão pode ler o player no mundo da página e revalidar os endereços no popup. A primeira versão usa `activeTab`, `scripting` e `downloads`. Uma permissão de host opcional para `https://cdn.syndication.twimg.com/*` habilita a consulta de publicações públicas do X por ID, sem cookies. O projeto dispensa listeners de tráfego, polling e dependências de produção.
- O usuário escolhe o arquivo em uma lista que identifica o host de origem. Para mídia progressiva, a extensão delega a transferência à API `downloads` no clique. O navegador gerencia a duração da transferência e o destino. O app sugere um nome seguro sem caminhos absolutos, com renomeação automática em caso de colisão.
- Para HLS, o motor precisa ler bytes de manifestos, chaves, inicializações e segmentos. Solicitar acesso às origens específicas quando necessário, com gesto do usuário, e informar quais faltam. Origem descoberta num manifesto deve ser tratada antes de buscar o recurso. A descoberta e a transferência precisam reagir à negação, revogação, navegação, redirecionamento e URL expirada. `currentSrc`, Resource Timing e observação de rede têm cobertura parcial. Qualquer modo amplo depende de necessidade demonstrada e escolha explícita.
- O caminho HLS usa fila com orçamento global de bytes, Worker dedicado, OPFS e exportação pela API do navegador. No Chromium, provar criação do Worker e da URL `blob:` em offscreen e entrega iniciada pelo background. No Firefox, provar uma página de extensão com vida própria em relação ao popup antes de escolher o hospedeiro definitivo. A prova deve atravessar uma espera ociosa e confirmar o término real da entrega.
- [A validação do M1](docs/validacao-m1.md) demonstrou a exportação de uma amostra por OPFS nos dois motores. A prova do Chromium precisou sugerir o nome via `onDeterminingFilename`, restrito à URL do trabalho e ao ID da extensão. O M2 deve confirmar o tipo MIME, a memória e o comportamento com arquivos grandes.
- Manter os tipos e as fronteiras do motor em TypeScript. Definir as portas quando houver consumidores concretos. O transporte precisa devolver status, cabeçalhos necessários, URL final e corpo cancelável. O armazenamento precisa expor cota estimada, reabertura e truncamento. O remux define as fronteiras nas quais o arquivo pode ser retomado. A UI consulta estado por ID. Bytes da mídia não transitam por mensagens da extensão.

## Matriz de HLS

| Caso | Compromisso | Verificação |
| --- | --- | --- |
| VOD, MPEG-TS com H.264 e AAC | Obrigatório M2 | Um fMP4 reproduzível do início ao fim, com duração e busca verificadas |
| Master com variantes | Obrigatório M2 | Selecionar a maior resolução compatível e usar a banda para desempatar. Permitir escolha manual compatível |
| AES-128 com formato de chave padrão | Obrigatório M2 | Fixtures com URI de chave, IV explícito e por sequência, rotação de chave e erros controlados |
| fMP4 com `EXT-X-MAP` | Avaliar M2 | Init e fragmentos compatíveis, com troca de init avaliada separadamente |
| Rendição de áudio separada | Avaliar antes de prometer suporte em M3–M4 | Faixas sincronizadas e reproduzíveis após união |
| `BYTERANGE` e descontinuidades | Avaliar M2 | Resposta de intervalo conferida e continuidade temporal na saída |
| Proteção reconhecida e formato incompatível | Obrigatório M2 | Mensagens distintas e nenhum arquivo parcial apresentado como conclusão |
| Live e DASH | Posterior | Detectar e indicar indisponibilidade quando identificado |

As fixtures cobrem combinações anunciadas, não apenas casos isolados. Aceite de reprodução em VLC e nos navegadores anunciados. O muxer deve ser escolhido pela prova com as fixtures. A funcionalidade documentada do [mux.js](https://github.com/videojs/mux.js/blob/main/README.md) cobre MPEG-TS para fMP4. União de faixas já fragmentadas requer validação independente. A interpretação do manifesto segue a [RFC 8216](https://www.rfc-editor.org/rfc/rfc8216.html).

## Armazenamento e retomada

- Estados previstos incluem em fila, baixando, pausado, pronto para exportar, exportando, concluído, falha recuperável, falha definitiva e cancelado. Pausa e falha recuperável preservam o checkpoint. Cancelamento libera temporários. Falha definitiva remove artefatos sem uso. Remover a cópia do OPFS após confirmação do navegador e varrer órfãos preservando trabalhos recuperáveis.
- Após uma unidade recuperável ser gravada e sincronizada, confirmar no IndexedDB o offset, a posição da mídia, a variante e o estado de remux necessário. Ao reabrir, truncar bytes além do offset confirmado. Conferir identidade e continuidade da mídia. Se o muxer não permitir retomada confiável, a opção a medir é guardar segmentos e refazer apenas o remux.
- Preservar um arquivo já montado para repetir a exportação. Associar o ID que o navegador devolve ao trabalho e consultar o estado desse download após reinício. Se a mídia exigir uma URL renovada, tentar redescobri-la na origem com autorização disponível e oferecer reinício quando a identidade não puder ser confirmada.
- `navigator.storage.estimate()` estima a cota do OPFS. O espaço real da pasta final pode ser desconhecido. Mostrar tamanhos aproximados quando disponíveis, considerar temporário e cópia final e tratar falta de cota e falta de espaço como erros diferentes.

## Segurança e privacidade

- CSP restrita, código empacotado e sem execução remota. Tratar páginas, URLs, redirecionamentos e playlists como entradas não confiáveis. Restringir protocolos, recusar credenciais em URLs de entrada, nunca inserir títulos como HTML e higienizar nomes de arquivos. O motor HLS deve validar a origem a cada transição de rede. Requisições futuras a hosts locais exigem ação explícita compatível com o cenário de uso.
- Limitar bytes de manifestos, metadados, filas, respostas de chave e segmentos em memória. Aplicar timeouts e retry com backoff a falhas transitórias. Indicar por que uma entrada ultrapassou o envelope suportado. Fazer fuzzing periódico dos parsers antes de expandir formatos.
- O popup guarda a detecção só durante seu uso. O navegador administra seu próprio histórico de downloads. Para o futuro motor persistente, guardar o mínimo para retomada, apagar junto com o trabalho e excluir URLs, tokens e títulos de logs, fixtures e issues.
- Começar com regras empacotadas. Se atualizações remotas forem consideradas, reavaliar política da loja e privacidade antes de lançar. Exigir esquema declarativo fechado, assinatura, proteção contra rollback e configuração de adesão explícita. O host estático recebe o IP da conexão.
- Fixar dependências e toolchain no build. Usar lockfile, auditoria, revisão de dependências, SBOM e assinatura de releases conforme a publicação avançar. Para Firefox, fornecer fonte e fluxo de build reproduzível para revisão. Distribuição em Firefox estável requer assinatura da Mozilla, inclusive com hospedagem própria.

## Desempenho e testes

- Mídia progressiva é transferida pelo navegador. Para HLS, a meta é manter os buffers de mídia independentes da duração, com concorrência limitada por bytes e janela de reordenação. Contabilizar resposta, decifragem, saída do remux e vários jobs. Um segmento acima do orçamento precisa de tratamento explícito. Medir também o crescimento dos metadados da playlist.
- Cenário de referência do M2 com HLS sintético de 1 GB, H.264/AAC em MPEG-TS, segmentos de ~4 s a ~8 Mbps e versões clara e AES-128. Registrar hardware, navegador, sistema, configuração, memória de base, pico em processamento e pico em exportação. Orçamento inicial de 64 MB de dados em trânsito e meta provisória de menos de 150 MB de pico atribuível. Calibrar o método em cada motor antes de bloquear CI.
- Medir p95 até mostrar candidatos em perfil limpo e mirar 300 ms com mídia já carregada. Comparar a velocidade de transferência com `curl` sobre os mesmos segmentos e mesma configuração de rede, medindo o tempo de processamento e exportação separadamente. A meta inicial da transferência é 90% da referência.
- Unidade para validação de URL, sanitização, parser e política de rede. Integração com duas origens locais e mídia sintética. Teste de navegador com popup fechado, arquivo final comparado byte a byte e permissões revogadas quando aplicáveis. A matriz de sistemas operacionais cresce a partir dos builds comprovados. Benchmarks começam como relatório. Os canários externos complementam os testes determinísticos e só abrem uma issue por falha confirmada.

## Distribuição e doações

Snagly é o nome de trabalho. O código do projeto usa MIT. As dependências mantêm suas próprias licenças. A revisão de publicação deve conferir termos das plataformas, direitos sobre a mídia, políticas vigentes de cada loja e declarações de privacidade coerentes com o comportamento. O plano inicial de distribuição é Firefox AMO e depois Chrome/Edge. GitHub Releases pode hospedar os artefatos adequados a cada navegador.

Pix e link internacional podem vir no M8, com QR embutido e acesso discreto a partir da interface. A chave aleatória evita publicar CPF, telefone ou e-mail como chave. O pagador ainda pode receber dados de identificação bancária do recebedor. Confira política dos canais escolhidos e tratamento fiscal antes de ativar o recebimento.
