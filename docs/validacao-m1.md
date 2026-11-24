# Validação inicial em Windows

## Build progressivo

Chrome e Chrome for Testing 158.0.8127.36, Brave com Chromium 158.0.8127.42 e Firefox 160.0.1 rodaram os builds Manifest V3 em perfis descartáveis. A página de teste e o servidor de mídia escutavam em portas locais distintas. Os arquivos foram gerados com FFmpeg.

| Cenário | Chromium | Firefox |
| --- | --- | --- |
| Ação da extensão abriu o popup e detectou quatro fontes na aba ativa | Passou | Passou |
| MP4, WebM, M4A e MP3 de outra origem terminaram com o popup fechado | Passou | Passou |
| Cada arquivo salvo era idêntico à fonte | Passou | Passou |
| Tamanho descompactado do build | 6,26 kB | 6,41 kB |

**Decisão do M1.** Usar `activeTab` e `scripting` para detectar a mídia quando o usuário abre o popup. A API `downloads` transfere a mídia progressiva e preserva o download após o fechamento. O manifesto pode ficar sem concessões de host. O acesso específico à origem passa a ser necessário quando o motor HLS lê respostas, como manifestos e segmentos.

O tamanho do build mede os arquivos empacotados. As metas de uso de RAM, latência e throughput exigem cenários instrumentados. Edge, Opera, Firefox ESR, macOS e Linux ainda precisam de validação individual.

## OPFS em uma extensão de prova

Um Worker gravou 2 MiB de dados determinísticos com `createSyncAccessHandle()`, chamou `flush()` e fechou o handle. Uma página de extensão reabriu o arquivo, criou a URL `blob:` e transferiu pelo gerenciador de downloads. A prova verificou os bytes no disco de destino.

- **Firefox.** Uma página dedicada da extensão executou o Worker e iniciou a entrega com o nome solicitado. A prova confirmou a limpeza do temporário após a conclusão.
- **Chromium.** Um documento offscreen abrigou o Worker. Depois de fechar a página que iniciou o teste e aguardar cerca de 35 segundos, o documento enviou a URL ao background para iniciar a entrega. O service worker estava ocioso e fora da lista de alvos do navegador antes do envio. O caminho básico salvou os bytes com um UUID apesar do parâmetro `filename`. Um listener de `onDeterminingFilename` limitado ao ID da extensão e à URL do trabalho fez a amostra chegar com o nome solicitado.

A prova valida a transferência de uma amostra pequena. Para escolher o caminho de produção, repetir com mídia representativa, confirmar nome e tipo MIME e medir a memória durante a exportação. Documentação das APIs usadas. [Chrome Offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) · [Chrome Downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads) · [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)

## Prova local de retomada HLS

Com FFmpeg disponível no PATH, executar `node tools/check-hls-checkpoint.mjs`. O teste gera HLS VOD de 8 s em H.264/AAC, interrompe um processo no meio da gravação de um segmento, reabre o arquivo e trunca os bytes além do offset confirmado. Depois termina a gravação e remuxa para fMP4. O resultado é decodificável até o fim e idêntico ao controle sem interrupção.

O teste cobre o modelo de checkpoint com arquivos locais, Node.js e FFmpeg. Integrar OPFS, IndexedDB, variante/URLs, remux no navegador e recuperação de exportação continua no escopo do motor HLS.
