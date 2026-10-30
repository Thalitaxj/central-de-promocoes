# Central de Promoções — Assistente de Compras Inteligente

Loja virtual moderna com assistente de listas de compras, comparação de preços
entre lojas (Amazon, Shopee, Mercado Livre e Central de Promoções), carrinho multi-loja
e links de afiliados. Site 100% estático (HTML + CSS + JavaScript puro, sem
dependências e sem build).

## Como rodar localmente

Opção 1 — abrir direto: dê dois cliques em `index.html`.

Opção 2 — servidor local (recomendado):

```bash
python -m http.server 5500
```

Depois acesse: http://localhost:5500

## Como publicar GRATUITAMENTE

O site é estático, então qualquer uma destas opções hospeda de graça.
Você não precisa de cartão de crédito em nenhuma delas.

### Opção A — Netlify Drop (a mais rápida, sem conta de desenvolvedor)

1. Acesse https://app.netlify.com/drop
2. Arraste a pasta inteira do projeto (`promo`) para a área indicada.
3. Pronto. O Netlify gera um link público na hora (ex.: `nome-aleatorio.netlify.app`).
4. Crie uma conta grátis para manter o site e poder atualizá-lo depois.

> O arquivo `netlify.toml` já está configurado — não precisa mexer em nada.

### Opção B — GitHub Pages (bom se você já usa GitHub)

1. Crie um repositório no GitHub (público) e envie estes arquivos.
2. No repositório: **Settings > Pages**.
3. Em "Branch", selecione `main` e a pasta `/ (root)`. Salve.
4. Em alguns minutos o site fica no ar em
   `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Comandos para enviar ao GitHub (execute na pasta do projeto):

```bash
git init
git add .
git commit -m "Site Central de Promoções"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
git push -u origin main
```

### Opção C — Cloudflare Pages

1. Acesse https://pages.cloudflare.com e crie conta grátis.
2. Conecte seu repositório do GitHub (ou faça upload direto).
3. Em "Build settings", deixe o comando de build **vazio** e o diretório de
   saída como `/` (raiz). Publique.

## Domínio próprio (opcional, único item com custo)

Todas as opções acima dão um endereço grátis (`.netlify.app`,
`.github.io`, `.pages.dev`). Um domínio próprio (ex.: `centraldepromocoes.com.br`)
custa cerca de R$ 40 a R$ 60 por ano no registro.br — totalmente opcional.

## Links de afiliados

Abra `script.js` e preencha suas tags no bloco `AFFILIATE` (no topo do arquivo):

```js
const AFFILIATE = {
  amazon:       "",   // ex.: "central-20"
  shopee:       "",
  mercadolivre: ""
};
```

Enquanto vazio, os links funcionam como busca normal. Ao preencher, viram
links de afiliado automaticamente. O cadastro nos programas de afiliados é
gratuito — você recebe comissão por venda.

## Observação sobre preços

Os preços e avaliações por loja são dados de referência do catálogo (em
`script.js`), não cotações ao vivo. Marketplaces não oferecem API pública
gratuita para preços em tempo real num site estático. Para preços dinâmicos
seria necessário um backend com as APIs oficiais de afiliados.
