# AutoMotion Mobile — MVP

Editor de motion automático, pensado para rodar no celular e sem servidor pago.

## O que este MVP já faz

1. Recebe um vídeo no navegador.
2. Usa FFmpeg WebAssembly no próprio navegador para extrair áudio WAV.
3. Usa Transformers.js + Whisper (`Xenova/whisper-tiny`) para transcrever em português e obter timestamps por palavra.
4. Agrupa palavras em trechos e classifica temas por um conjunto de gatilhos locais (finanças, redes sociais, tecnologia, games, música, fitness, educação e viagem).
5. Cria cards animados com entrada, ícone e posição alternada.
6. Renderiza o resultado em um canvas e exporta WebM pelo `MediaRecorder`.
7. Tenta converter o WebM para MP4 com FFmpeg WebAssembly.
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

Este MVP não inclui rastreamento facial MediaPipe/YOLO nem geração de ilustrações Lottie. A posição automática usa alternância inteligente entre esquerda/direita; isso deixa a base pronta para acrescentar rastreamento real na próxima versão.
