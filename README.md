# AutoMotion Studio V12.2

Correção de carregamento para GitHub Pages/PWA.

- Desativa o Service Worker antigo para impedir cache de `app.js`.
- Remove o carregamento direto do módulo e inicializa `app.js?v=12.2.0` depois de desregistrar SW antigos.
- Mantém o renderizador Mediabunny da V12.1.
- Mantém análise automática via Whisper/Transformers.js.

## Publicação
Substitua os arquivos do repositório pelos arquivos desta pasta. Abra a página com `?v=12.2` na primeira vez.
