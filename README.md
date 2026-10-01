# AutoMotion Mobile V8

Evolução focada em estabilidade e renderização mobile.

## Principais mudanças
- Render otimizado: 30 FPS no Android/iPhone e 60 FPS no desktop.
- Resolução máxima adaptativa: 1280 px no mobile e 1920 px no desktop.
- Usa `requestVideoFrameCallback` quando disponível para acompanhar os frames reais do vídeo.
- Atualização da barra de progresso limitada para reduzir carga na interface.
- `captureStream()` ajustado para a taxa de render.
- Bitrate reduzido de forma adaptativa para evitar picos de memória/CPU.
- Botão para interromper uma renderização.
- URLs de WebM/MP4 antigas são liberadas para evitar acumulo de memória.
- Conversão MP4 usa preset ultrafast e áudio 96 kbps para diminuir carga.

## Importante
A exportação no navegador acontece em tempo real ou próxima disso; um vídeo de 5 minutos pode levar alguns minutos para renderizar. A V8 prioriza não congelar o navegador durante esse processo.
