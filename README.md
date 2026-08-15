# Tigrinho da Sorte — Simulador Demonstrativo

## ⚠️ Atualização: sistema de "vias" (grade 3x3)

O jogo migrou de 3 espaços únicos para uma grade **3 rolos x 3 posições**
(9 espaços), com pagamento por **"ways to win"** — qualquer símbolo que
aparecer nos 3 rolos (em qualquer altura) paga, multiplicado pela
quantidade de repetições. É o mesmo padrão usado por slots comerciais como
o Fortune Tiger.

**Passo obrigatório antes de testar:** aplique a migration
`supabase/migrations/0003_ways_to_win.sql` no seu projeto Supabase — ela
substitui a função `spin_slot` para devolver a grade 3x3 em vez de 3
símbolos únicos. Sem isso, o front-end novo não vai bater com o que o
banco retorna.

Como aplicar: abra o **SQL Editor** no painel do Supabase, cole o conteúdo
de `supabase/migrations/0003_ways_to_win.sql`, e rode. (Ou `supabase db
push` se estiver usando a CLI com as migrations linkadas ao projeto.)

---

Simulador de slot + jogo de progressão (Torre) inspirado no clima visual dos
jogos "tigrinho", com **arte original em SVG** e **sons sintetizados via Web
Audio API** — nenhum asset de terceiros é usado. Todo o saldo é fictício, sem
Pix, sem dinheiro real, sem persistência em servidor.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/` — pronta pra deploy estático (Vercel, Netlify, GitHub Pages).

## Subir no GitHub

```bash
git init
git add .
git commit -m "Simulador Tigrinho da Sorte"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/tigrinho-sorte.git
git push -u origin main
```

Troque `SEU_USUARIO` pelo seu usuário do GitHub (ex: `Pauloplanob1402`).

## Deploy no Vercel

1. Importe o repositório em vercel.com/new.
2. Framework preset: **Vite** (detectado automaticamente).
3. Build command: `npm run build` — Output directory: `dist` (padrão, não precisa mexer).
4. Deploy.

## Estrutura do projeto

```
src/
  core/
    random.ts          → PRNG xoshiro128+ (mesmo usado na Fortuna do Tigre)
    symbols.ts          → tabela de símbolos e pesos (calibração de RTP)
    useGameManager.ts    → hook de créditos demo e estatísticas de RTP
  sound/
    soundEngine.ts       → todos os sons sintetizados (sem arquivos de áudio)
  symbols/
    Icons.tsx            → ícones SVG originais (tigre, moeda, lingote, etc.)
  components/
    Reel.tsx              → animação de um rolo do slot
    SlotMachine.tsx        → slot completo (3 rolos, aposta, paytable)
    ProgressionTower.tsx   → jogo de progressão tipo Torre
    HUD.tsx                → cabeçalho com créditos e RTP
  App.tsx                 → abas Slot / Torre
  index.css               → identidade visual (dourado/carmesim, lanternas)
```

## Calibrar o RTP

O RTP (Return to Player) alvo de ~95% está calibrado nos pesos de
`src/core/symbols.ts` (slot) e nos `LEVELS` de `src/components/ProgressionTower.tsx`
(torre). Pra testar se o RTP real bate com o alvo antes de ajustar visualmente,
dá pra rodar uma simulação em lote — se quiser esse script de calibração
separado (roda no terminal com Node, sem abrir o navegador), é só pedir.
