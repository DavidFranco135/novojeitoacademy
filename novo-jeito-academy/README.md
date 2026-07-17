# Novo Jeito Academy

Plataforma completa do curso online de barbeiro: site público, matrícula com contrato assinado digitalmente, pagamento via Mercado Pago, área do aluno com vídeo-aulas e certificado automático, turmas presenciais com check-in por QR Code, e painel administrativo.

## Estrutura do projeto

```
novo-jeito-academy/
├── public-site/        → Landing page de vendas (HTML estático, deploy no Cloudflare Pages)
│   └── index.html
├── app/                 → App React (matrícula, área do aluno, admin)
│   └── src/pages/
│       ├── Matricula.tsx
│       ├── Aluno.tsx
│       ├── PresencialBooking.tsx
│       └── Admin.tsx
├── functions/           → Backend (Firebase Functions)
│   └── src/
│       ├── enrollment.ts      → cadastro, contrato em PDF, pagamento Mercado Pago
│       ├── certificate.ts     → geração automática do certificado em PDF
│       ├── presencial.ts      → turmas presenciais + check-in por QR Code
│       └── imgbb.ts           → upload de imagens (fotos do site) via ImgBB
├── firebase.json
├── firestore.rules
└── storage.rules
```

## Stack utilizada

| Peça | Ferramenta |
|---|---|
| Banco de dados | Firebase Firestore |
| Backend / API | Firebase Functions (Node 20) |
| Autenticação | Firebase Auth *(a implementar — ver seção abaixo)* |
| Armazenamento de PDFs (contrato/certificado) | Firebase Storage |
| Fotos do site (capa, galeria, instrutor) | ImgBB |
| Vídeo das aulas | Cloudflare Stream |
| Pagamento | Mercado Pago (cartão, PIX, boleto) |
| Hospedagem do site público | Cloudflare Pages |
| Hospedagem do app (matrícula/aluno/admin) | Firebase Hosting *(ou Cloudflare Pages, ver abaixo)* |

---

## 1. Configurar o Firebase

```bash
npm install -g firebase-tools
firebase login

# na raiz do projeto:
cp .firebaserc.example .firebaserc
# edite .firebaserc e coloque o ID real do seu projeto Firebase
```

### Secrets necessários

```bash
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
firebase functions:secrets:set CHECKIN_SECRET
firebase functions:secrets:set IMGBB_API_KEY
```

- `MERCADOPAGO_ACCESS_TOKEN`: pegue em [Mercado Pago Developers](https://www.mercadopago.com.br/developers) → Suas integrações → Credenciais de produção
- `CHECKIN_SECRET`: qualquer string longa e aleatória (ex: gere com `openssl rand -hex 32`)
- `IMGBB_API_KEY`: a mesma já usada no sistema da barbearia (imgbb.com → API)

### Instalar dependências e subir as functions

```bash
cd functions
npm install
npm run deploy
```

Isso publica as seguintes rotas (troque `SEUPROJETO` pelo ID real):
- `https://us-central1-SEUPROJETO.cloudfunctions.net/createEnrollment`
- `.../signContract`
- `.../createPaymentPreference`
- `.../mercadopagoWebhook`
- `.../generateCertificate`
- `.../createPresencialSession`
- `.../listPresencialSessions`
- `.../bookPresencialSession`
- `.../confirmCheckin`
- `.../uploadImage`

## 2. Configurar o Mercado Pago

No arquivo `functions/src/enrollment.ts`, troque:
```ts
back_urls: {
  success: "https://SEUSITE.com/matricula/sucesso",
  failure: "https://SEUSITE.com/matricula/erro",
  pending: "https://SEUSITE.com/matricula/pendente",
},
notification_url: "https://SEUREGIAO-SEUPROJETO.cloudfunctions.net/mercadopagoWebhook",
```
pelas URLs reais do seu domínio e projeto.

## 3. Configurar o Cloudflare Stream (vídeos das aulas)

1. Ative o Cloudflare Stream no painel da Cloudflare
2. Faça upload de cada vídeo de aula — cada um recebe um `videoUid`
3. Em `app/src/pages/Aluno.tsx`, troque `customer-XXXX` pelo seu subdomínio do Stream (aparece no painel) e preencha os `videoUid` reais no lugar do array `MOCK_MODULES` (ou, melhor, isso deve vir do Firestore via API — hoje está mockado pra visualização)

## 4. Configurar o ImgBB (fotos do site)

Já usa a mesma API da barbearia — só reaproveitar a `IMGBB_API_KEY`. Para subir uma foto (ex: pelo painel admin), chame:
```
POST /uploadImage
{ "imageBase64": "data:image/png;base64,...", "name": "capa-curso" }
```
A resposta traz a `url` pronta pra usar em qualquer `<img src="">`.

## 5. Deploy do site público (Cloudflare Pages)

```bash
# via painel da Cloudflare:
# Workers & Pages → Create → Pages → Connect to Git
# Root directory: public-site
# Build command: (nenhum, é HTML puro)
# Output directory: public-site
```

Antes do deploy, edite `public-site/index.html` e troque os placeholders:
- Fotos (`📷` `🎬` `👤` e os ícones da galeria) → `<img src="URL_DO_IMGBB">`
- Vídeo de apresentação → embed real do Cloudflare Stream
- Link do botão final "Garantir minha vaga" → já aponta para `https://app.novojeitoacademy.com.br/matricula` (troque pelo seu domínio real do app)

## 6. Deploy do app (matrícula / aluno / admin)

```bash
cd app
npm install
npm run build
firebase deploy --only hosting
```

Ou, se preferir manter tudo no Cloudflare: publique a pasta `app/dist` gerada como um segundo projeto no Cloudflare Pages.

## 7. Autenticação (implementada — dois logins separados)

**Aluno** (`/login`): link mágico por e-mail, sem senha — mais simples pra quem usa raramente.

**Equipe interna** (`/admin-login`): e-mail + senha tradicional — mais rápido pra quem acessa todo dia. O acesso fica escondido dentro da assinatura **"Produzido por NIKLAUS"**, no rodapé do site público — a palavra "NIKLAUS" é o link de verdade, mas visualmente passa só como crédito de produção, sem chamar atenção de visitante comum.

1. No Firebase Console → **Authentication** → **Sign-in method** → ative **"E-mail link (sem senha)"** (aluno) **e** **"E-mail/senha"** (equipe interna)
2. Em **Authentication → Settings → Domínios autorizados**, adicione o domínio real do seu app
3. Em `app/src/pages/Login.tsx`, troque `ACTION_URL` pela URL real do app
4. O usuário do Firebase Auth (aluno) é criado automaticamente pela função `mercadopagoWebhook` assim que o pagamento é aprovado

**Liberar acesso de admin (sem terminal):**

1. A pessoa acessa `/admin-login`, clica em **"Primeira vez aqui? Criar acesso"**, define e-mail e senha próprios
2. Tenta acessar `/admin` — aparece uma tela de "Acesso restrito" mostrando o **UID** dela na tela (copie esse código)
3. Vá no **Firebase Console → Firestore Database**
4. Clique em **"Iniciar coleção"**
5. ID da coleção: `admins`
6. ID do documento: **cole o UID copiado no passo 2**
7. Adicione um campo qualquer (ex: nome do campo `role`, tipo `string`, valor `admin`)
8. Clique em **Salvar**
9. A pessoa recarrega a página `/admin` — acesso liberado

Repita esse processo pra cada pessoa que precisar de acesso admin (ex: você e o dono da barbearia). Criar login em `/admin-login` **não dá acesso sozinho** — só quem tem o UID cadastrado em `admins` consegue de fato entrar.

Preencha também `app/src/firebase.ts` com as credenciais do seu projeto (Console Firebase → Configurações → Seus apps → SDK setup).

Preencha também `app/src/firebase.ts` com as credenciais do seu projeto (Console Firebase → Configurações → Seus apps → SDK setup).

## 8. LGPD / Termos / Cookies

- `public-site/termos-de-uso.html` e `public-site/privacidade.html` têm texto real, mas contêm placeholders `[PREENCHER]` (razão social, CNPJ, e-mail de contato/DPO) — **edite antes de publicar**
- O banner de cookies (`index.html`) já funciona: salva a escolha em `localStorage` e só libera scripts de analytics/pixel após aceite explícito
- Para adicionar Google Analytics/Meta Pixel: edite a função `loadAnalytics()` no final do `index.html`

## 9. PWA (instalável no celular)

Tanto o site público quanto o app têm `manifest.json` — o visitante pode "Adicionar à tela inicial" pelo Safari (iOS) ou Chrome (Android), como um app nativo.

**Falta apenas:** gerar os ícones reais (`icon-192.png` e `icon-512.png`, fundo com o logo dourado sobre preto) e colocá-los em `public-site/` e `app/public/`. Sem eles, o PWA funciona mas usa um ícone genérico.

## 10. SEO

- `public-site/robots.txt` e `public-site/sitemap.xml` já criados — troque `novojeitoacademy.com.br` pelo seu domínio real em ambos
- As meta tags Open Graph/Twitter Card (`index.html`) fazem o link aparecer com capa/descrição bonita ao ser compartilhado no WhatsApp — falta apenas gerar a imagem `og-image.jpg` (1200x630px) e subir na raiz do site

---

## 11. Bolsa de 100% (candidaturas)

Página `public-site/bolsa.html` — formulário simples (nome, WhatsApp, idade, profissão, motivo), salva via `applyScholarship` no Firestore, e aparece no painel Admin → aba **Bolsas**, com botão direto pra chamar no WhatsApp.

Antes de publicar, troque `APPLY_URL` em `bolsa.html` pela URL real da function após o deploy.

## 12. Ecossistema Barbearia + Academy (recomendação)

Os dois sistemas (barbearia e academy) ficam mais fortes se puderem se referenciar. Duas coisas valem a pena, fora do escopo deste repositório (ficam no sistema da barbearia, que é um projeto separado):

- **Domínio único**: em vez de dois domínios soltos, considere `novojeito.com.br/` para o site da barbearia e `novojeito.com.br/academy` para este projeto (ou subdomínios `barbearia.novojeito.com.br` / `academy.novojeito.com.br`). Isso é configuração de DNS/roteamento no Cloudflare, não muda o código.
- **CTAs cruzados**: no app da barbearia, um banner "Quer aprender a profissão de barbeiro?" apontando para a landing page da Academy; na Academy, um "Agende um corte e conheça nossa estrutura" apontando para o app da barbearia. Isso é só um bloco de link/banner em cada sistema — pode ser adicionado quando quiser, não depende de nenhuma integração técnica entre os dois.

## 13. Conteúdo do Site (editável sem código)

A partir de agora, a página pública (`public-site/index.html`) **não é mais 100% fixa** — ela busca automaticamente os textos, fotos, vídeo e preço salvos no Firestore assim que carrega, através da função `getSiteContent`.

**Onde editar:** painel Admin → aba **"Conteúdo do Site"** (`app/src/pages/Admin.tsx`, componente `ConteudoSite`). De lá dá pra trocar:
- Foto de capa, título e texto do topo
- Estatísticas (alunos formados, aulas, avaliação)
- Vídeo de apresentação (cole a URL de embed do Cloudflare Stream/YouTube/Vimeo)
- As 6 fotos da galeria
- Foto, nome e biografia do instrutor
- Preço e número de parcelas

Cada foto tem upload direto (clica na área tracejada, escolhe o arquivo) — vai automaticamente pro ImgBB e salva a URL.

**Antes de funcionar, troque os placeholders `SEUPROJETO`** nas 3 URLs no topo do componente `ConteudoSite` (em `Admin.tsx`) e também em `GET_CONTENT_URL` no `public-site/index.html`, pela URL real do seu projeto Firebase após o deploy das functions.

**Segurança:** salvar (`updateSiteContent`) exige estar logado E estar na coleção `admins` do Firestore — mesma trava de acesso do resto do painel. Ler o conteúdo (`getSiteContent`) é público, porque é isso que alimenta a página que todo visitante vê.

---

## Ordem recomendada de execução

1. Firebase (secrets + deploy das functions + Authentication ativado — "E-mail link" e "E-mail/senha")
2. Preencher `app/src/firebase.ts` com as credenciais reais
3. Mercado Pago (URLs reais)
4. Testar matrícula ponta a ponta + confirmar criação automática do login do aluno
5. Criar seu acesso em `/admin-login` e liberar seu UID na coleção `admins` do Firestore
6. Cloudflare Stream (vídeos) + ImgBB (fotos)
7. Editar `termos-de-uso.html`/`privacidade.html` (preencher CNPJ, e-mail, etc.)
8. Trocar os placeholders `SEUPROJETO` nas URLs de functions (`index.html`, `bolsa.html`, `Admin.tsx`)
9. Usar a aba "Conteúdo do Site" pra subir fotos reais, vídeo e ajustar textos
10. Gerar ícones do PWA e a imagem Open Graph
11. Deploy do site público (Cloudflare Pages) e do app (Firebase Hosting)
