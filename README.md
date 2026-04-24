# PLANO.BARRIGA — v2 (upgrade completo)

Versão revisada do tracker, com correções dos bloqueadores e features novas.

## Arquivos entregues

| Arquivo | Função |
|---|---|
| `index.html` | App principal. Self-contained (React + Babel via CDN). Abre direto no navegador. |
| `sw.js` | Service Worker — cacheia o app shell pra funcionar offline. |
| `manifest.webmanifest` | Manifest PWA pra instalar no celular como app. |
| `worker-proxy.js` | Template do Cloudflare Worker que protege sua API key da Anthropic. |
| `REVIEW.md` | Este documento. |

## O que mudou em relação à v1

### Bloqueadores consertados

1. **API key fora do cliente.** A chamada agora vai pro seu proxy (Cloudflare Worker), que adiciona a `x-api-key` server-side. A chave nunca toca o browser. Configure a URL do proxy na tela de Configurações do app.
2. **Fotos em IndexedDB.** As fotos saíram do localStorage (que estoura em ~2 semanas de uso) e foram pra IndexedDB (50MB+). O localStorage guarda só o resto (análises, treino, medidas, notas).
3. **Export / Import JSON.** Botão em Configurações que baixa tudo (localStorage + IndexedDB) num arquivo `.json`. Safety net caso o browser limpe storage ou você troque de aparelho.

### Bugs + UX

4. **`setSaved(false)` em todas as mudanças.** Antes nem toda alteração invalidava o "salvo" — agora cardio, macros, medidas, tudo invalida corretamente.
5. **TDEE e meta de calorias configuráveis.** Antes estavam hardcoded em 2600/2200. Agora tem tela de Configurações com campos editáveis + preset de recalcular conforme peso atual.
6. **Horário de treino flexível.** Antes assumia treino à tarde. Agora você escolhe "manhã / tarde / noite" e o app reorganiza a ordem das refeições (pré/pós treino vai pro slot correto).
7. **Macros agregados do dia.** Linha no topo somando P/C/G de todas as refeições analisadas.
8. **Sexta removida do "Grupo fraco 1/2".** Agora é Full Body com 5 exercícios concretos compostos.
9. **Água com feedback visual.** Agora o último copo preenchido tem borda destacada — fica óbvio que é "marcar até aqui".

### Features novas

10. **Gráfico de progresso.** Curva de peso + cintura + abdomen + quadril ao longo do tempo (Chart.js).
11. **Streak counter.** Contador de dias consecutivos no alvo de déficit, exibido no cabeçalho.
12. **PWA instalável.** Manifest + service worker. No celular aparece "Adicionar à tela inicial" e vira app com ícone próprio. Funciona offline.
13. **Timer de descanso entre séries.** Botão em cada exercício que inicia contagem regressiva de 60/90/120s com vibração no celular quando acaba.

## Como rodar local (desenvolvimento)

Só abrir o `index.html` num navegador moderno. Funciona sem servidor. A análise de IA não vai funcionar até você configurar o proxy (ver próxima seção) — mas todo o resto (registro de refeições, treino, medidas, gráfico) funciona 100%.

> Nota: service worker e PWA só funcionam quando servido via `https://` ou `http://localhost`. Abrir com `file://` direto não registra o SW (os outros recursos funcionam normal).

## Como fazer deploy

### 1) Subir o app no GitHub Pages

```bash
# Crie um repo novo (ex: romarioproxxima/plano-barriga) e adicione os arquivos:
git init
git add index.html sw.js manifest.webmanifest
git commit -m "Initial PLANO.BARRIGA v2"
git branch -M main
git remote add origin git@github.com:romarioproxxima/plano-barriga.git
git push -u origin main

# No GitHub → Settings → Pages → Source: main branch / root → Save
# Em ~1 minuto estará em https://romarioproxxima.github.io/plano-barriga/
```

### 2) Deploy do proxy no Cloudflare Workers

```bash
# Instale o wrangler (CLI do Cloudflare Workers)
npm install -g wrangler

# Login (abre browser)
wrangler login

# Crie o worker
mkdir plano-barriga-proxy && cd plano-barriga-proxy
# Copie worker-proxy.js pra cá como index.js

# Crie wrangler.toml:
cat > wrangler.toml <<EOF
name = "plano-barriga-proxy"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
# (vazio — a chave vai por secret)
EOF

# Adicione sua chave como secret (prompta valor de forma segura)
wrangler secret put ANTHROPIC_API_KEY
# → cole aqui sua sk-ant-... quando pedir

# Adicione a origem permitida (seu domínio do GitHub Pages)
wrangler secret put ALLOWED_ORIGIN
# → cole: https://romarioproxxima.github.io

# Deploy
wrangler deploy

# Copie a URL gerada (ex: https://plano-barriga-proxy.romarioproxxima.workers.dev)
# Cole essa URL na tela de Configurações do app (aba ⚙️)
```

### Custo esperado

O plano gratuito do Cloudflare Workers dá **100.000 requisições por dia**. Você vai usar ~4 por dia (uma por refeição analisada). Fica em 0,004% do limite — jamais paga nada.

A API da Anthropic você já paga conforme uso. Claude Haiku 4.5 é bem barato: ~$0.0002 por análise de refeição. 4 refeições/dia × 30 dias = $0.024/mês. Virtualmente grátis.

## Privacidade

Todos os dados (peso, medidas, fotos, notas) ficam **no seu dispositivo**. Nada é enviado pra lugar nenhum, exceto as imagens de refeição quando você clica "Analisar com IA" — e mesmo essas vão só pro proxy → Anthropic, sem passar por terceiros.

Export/Import permite você ter o backup em mãos se quiser.

## Próximos passos sugeridos (v3)

- Sync opcional com Supabase (pra usar em múltiplos aparelhos)
- Notificações push de lembrete de refeição/água
- Compartilhamento de card resumo do dia como imagem (útil pra grupo de WhatsApp)
- Integração com Google Fit / Apple Health pra importar cardio automaticamente
