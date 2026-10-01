# AutoMotion Mobile — MVP

Editor de motion automático, pensado para rodar no celular e sem servidor pago.

## O que este MVP já faz

1. Recebe um vídeo no navegador.
2. Usa os codecs nativos do navegador + Web Audio para extrair e converter o áudio para WAV, sem baixar FFmpeg durante a análise.
3. Usa Transformers.js + Whisper (`Xenova/whisper-tiny`) para transcrever em português e obter timestamps por palavra.
4. Agrupa palavras em trechos e classifica temas por um conjunto de gatilhos locais (finanças, redes sociais, tecnologia, games, música, fitness, educação e viagem).
5. Cria cards animados com entrada, ícone e posição alternada.
6. Renderiza o resultado em um canvas e exporta WebM pelo `MediaRecorder`.
7. Só carrega o FFmpeg WebAssembly quando o usuário pede a conversão para MP4.
8. Tem layout responsivo e manifest para instalação como app.

## Como usar no celular

O navegador precisa abrir a aplicação via HTTP/HTTPS, e não por `file://`. A forma mais simples é publicar esta pasta em um repositório do GitHub Pages ou usar o preview de um editor que ofereça um servidor local.

Depois de abrir o endereço no Chrome Android:

- escolha um vídeo curto para o primeiro teste;
- toque em **Analisar e gerar motions**;
- espere o primeiro download do Whisper;
- revise os cards e exporte o WebM;
- use **Converter WebM → MP4** apenas quando precisar de MP4.

## Observações de desempenho

O processamento é local e pode consumir bastante RAM/CPU. Em celulares modestos, comece com vídeos de 30–60 segundos. O modelo é baixado uma vez e fica em cache do navegador quando possível.

O FFmpeg não é baixado na abertura nem na análise; ele só é carregado ao tocar em “Converter WebM → MP4”. Em celulares modestos, isso evita a espera inicial de vários minutos.

Este MVP não inclui rastreamento facial MediaPipe/YOLO nem geração de ilustrações Lottie. A posição automática usa alternância inteligente entre esquerda/direita; isso deixa a base pronta para acrescentar rastreamento real na próxima versão.


### Correção V4
A seleção de WebGPU agora testa `navigator.gpu.requestAdapter()` e, se a GPU não estiver disponível ou falhar, o Whisper automaticamente usa WASM/CPU. Não é necessário ativar `--enable-unsafe-webgpu`.
