# Design system

**Estilo:** limpo, "SaaS de startup". Muito respiro, cards com borda sutil, cantos de 12px,
números `tabular-nums`. Fonte **Inter** (alternativa: Geist), pesos 400/500/600.

## Tokens de cor
Definidos como variáveis CSS em `apps/web/app/assets/css/tokens.css` e expostos ao Tailwind v4
via `@theme`. Componentes **nunca** usam hex.

| Token | Light | Dark |
|---|---|---|
| `--primary` | #1D5FA8 | #3B82D6 |
| `--primary-strong` | #0F2A4A | #0B1220 |
| `--primary-soft` | #EEF4FB | #13233D |
| `--accent` | #0D9488 | #2DD4BF |
| `--background` | #F8FAFC | #0B1220 |
| `--card` | #FFFFFF | #111A2E |
| `--border` | #E2E8F0 | #1E2A44 |
| `--foreground` | #0F172A | #E2E8F0 |
| `--muted-foreground` | #64748B | #94A3B8 |
| `--success` | #16A34A | #4ADE80 |
| `--warning` | #F59E0B | #FBBF24 |
| `--danger` | #DC2626 | #F87171 |

Dark mode por classe `.dark` no `<html>` (preferência salva; padrão = sistema).

**Aparência por navegador** (botão flutuante no canto inferior direito, `LayoutAparenciaFlutuante`; localStorage `meta-bi-fonte` e `meta-bi-tema-cores`): tamanho da fonte em 90–130% no `font-size` do `<html>` (tudo em rem acompanha) e temas de cores Azul (padrão), Esmeralda, Grafite, Vinho, Oceano e Violeta. Os temas ficam em `tokens.css` (`[data-tema]`, versão clara e escura) e trocam só a cor da marca: `--primary`, `--primary-strong`, `--primary-soft`, `--accent`, `--ring` e `--sidebar`. Gráficos com a paleta Padrão seguem o `--primary` do tema.
Contraste mínimo AA (4.5:1 texto, 3:1 elementos gráficos) — validar ao criar combinações novas.

## Gráficos
- Paleta categórica (`utils/charts/palette.ts`), nesta ordem:
  #1D5FA8, #0D9488, #F59E0B, #EF4444, #8B5CF6, #0EA5E9, #84CC16.
- Real = primary; Ano anterior = muted-foreground (tracejado/claro); Meta = accent (linha).
- Eixos e grid com `--border`/`--muted-foreground`; tooltip com valores via `formatBRL`.
- Options geradas por funções puras (`utils/charts/*.ts`) recebendo o tema; `BaseChart` re-renderiza ao trocar tema.
- Donut: no máximo 6 fatias + "Outros".
- **Paletas por usuário** (menu do usuário › Cores dos gráficos): Padrão, Esmeralda, Grafite, Vinho e Oceano, definidas só em `utils/charts/palette.ts` com versão clara e escura. Trocam a cor principal, a de comparação (ano anterior), a da meta e as fatias; texto e eixos seguem o tema. As tabelas comparativas usam `--grafico-principal`/`--grafico-comparacao` (e as versões `-soft`/`-forte`), sobrescritas no `<html>` pela paleta. O PDF sai com a paleta de quem pediu.

## Tipografia e espaçamento
| Uso | Tamanho/peso |
|---|---|
| Título de página | 24px / 600 |
| Título de card | 14px / 500, muted-foreground |
| Valor de KPI | 28px / 600, tabular-nums |
| Corpo / tabela | 14px / 400 |
| Legenda | 12px |
Espaçamento na escala de 4px do Tailwind; gap padrão entre cards 16px (24px ≥ lg).

## Componentes
- **Card:** fundo `--card`, borda 1px `--border`, raio 12px, padding 20px, sem sombra pesada.
- **KpiCard:** rótulo, valor, variação (seta + cor success/danger; neutra quando "—"), sparkline.
- **Tabelas:** cabeçalho fixo, zebra sutil, valores monetários alinhados à direita, linha de total em negrito.
- **Badge de status:** cor do cadastro de status (nome de token), texto com contraste AA.
- **FilterBar:** chips removíveis; em celular vira sheet.

## Layout
- Sidebar recolhível, fundo `--primary-strong`, logo branco (`public/brand/`), ícones lucide.
- Topbar: seletor de período, busca global, alternância de tema, menu do usuário.
- Breakpoints Tailwind; < md: sidebar vira drawer, grids de KPI em 2 colunas, tabelas com scroll horizontal próprio.
- Foco visível (anel `--primary`) e navegação completa por teclado.

## Marca
`apps/web/public/brand/logo-meta-hospitalar.webp` e `icone-meta.png` (baixados do site oficial).
Versão branca para a sidebar: a criar (SVG) **[PENDENTE: pedir arquivo vetorial à Meta]**.
