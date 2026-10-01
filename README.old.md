# AutoMotion Mobile V11

A renderização voltou para a página e não depende mais do Google Colab nem de FFmpeg.wasm.

Motor: Mediabunny + WebCodecs. O vídeo é processado localmente no navegador; `Conversion.process()` desenha as visualizações sobre cada frame e a conversão mantém a trilha de áudio primária.

Teste primeiro com **Testar 10s**. O tempo de renderização ainda depende do celular, mas a implementação evita o caminho FFmpeg.wasm e tenta aceleração de hardware do WebCodecs.

Biblioteca: https://mediabunny.dev/
