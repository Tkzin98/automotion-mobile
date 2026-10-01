# AutoMotion Studio V15

Editor web mobile-first para Motion automático em vídeos científicos/documentais.

## O que mudou
- Whisper Small multilíngue com português definido e timestamps por palavra.
- Whisper Base como fallback automático.
- Áudio normalizado em mono/16 kHz antes da transcrição.
- Extração de fatos/processos com sincronização pelo tempo real do Whisper.
- Direção visual padrão **Dark Documentary**: cinema científico, HUD discreto, cyan/violeta, grid fino e lower-third seguro.
- Renderização local com Mediabunny + WebCodecs.

### Importante
Na primeira análise, o navegador baixa os arquivos do modelo Whisper pelo Hugging Face. Depois, o navegador pode reaproveitar o modelo em cache.
