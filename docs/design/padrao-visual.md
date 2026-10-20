# Padrão visual dos outros projetos (referência)

> **Como vale neste projeto (decisão de 2026-10-20):** seguimos o **layout** deste padrão — menu
> lateral de 240px com topo de 56px alinhado à barra da página, sino de Novidades no topo do menu
> (vai para a barra do topo com o menu recolhido e no celular), itens do menu com letra de 14px e
> ícone de 18px, usuário no rodapé do menu, barra flutuante `? | A− A+ | paleta` com o **?** abrindo
> um guia (tour). **Cores, fontes e temas continuam os da Meta Hospitalar** (azul `#1D5FA8`, Inter,
> temas de `tokens.css`) — ver [design-system.md](design-system.md), que prevalece em caso de conflito.
> A stack de referência abaixo é React/Next; aqui o equivalente é Nuxt UI v4 + UIcon (i-lucide-*).

---

Extraído do código do projeto de origem em 2026-10-20. Stack de referência:
**Next.js (App Router) + Tailwind v4 + shadcn/ui (Radix) + lucide-react +
next-themes + recharts + sonner**. Fonte de verdade lá: `src/app/globals.css`,
`src/app/layout.tsx`, `src/components/ui/*`, `src/components/layout/*`.

## 1. Tipografia

| Uso                               | Fonte       | Pesos              | Como                         |
| --------------------------------- | ----------- | ------------------ | ---------------------------- |
| Corpo / UI (tabela, form, menu)   | **Manrope** | 400, 500, 600, 700 | `font-sans` (padrão do body) |
| Títulos de página e logo em texto | **Sora**    | 500, 600, 700      | `font-display`               |

```ts
// src/app/layout.tsx
import { Manrope, Sora } from 'next/font/google';
const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});
const sora = Sora({ variable: '--font-sora', subsets: ['latin'], weight: ['500', '600', '700'] });
// <html className={`${manrope.variable} ${sora.variable} h-full antialiased`}>
```

- **Fonte raiz 106,25%** (≈17px em vez de 16px) — usuários acharam o texto
  pequeno. Como quase tudo no Tailwind é `rem`, a UI inteira escala junto.
- Botões **A− / A+** deixam a pessoa escolher entre 93,75% · 100% · **106,25%
  (padrão)** · 112,5% · 118,75% · 125% · 137,5% (salvo no `localStorage`,
  aplicado no `<html>` por um script no `<head>` antes de pintar).

**Escala usada:**

| Elemento                              | Classes                                              |
| ------------------------------------- | ---------------------------------------------------- |
| Título da página                      | `font-display text-2xl font-semibold tracking-tight` |
| Título da tela inicial ("Bom dia, …") | `font-display text-3xl font-semibold tracking-tight` |
| Subtítulo da página                   | `text-muted-foreground text-sm`                      |
| Título de seção                       | `text-base font-semibold`                            |
| Título de card                        | `CardTitle` (`leading-none font-semibold`)           |
| Rótulo de grupo do menu               | `text-[11px] font-semibold uppercase tracking-wider` |
| Texto auxiliar / meta                 | `text-xs text-muted-foreground`                      |
| Números (contadores, datas em tabela) | `tabular-nums`                                       |

## 2. Cores

Tudo é **token CSS** (`--background`, `--primary`…) consumido pelo Tailwind
via `@theme inline` — nunca cor fixa em componente, exceto cores de
**status/prioridade** (seção 2.3), que são fixas de propósito.

### 2.1 Tema padrão (claro, "Índigo") e escuro ("Noite")

| Token                     | Claro                                             | Escuro                                            |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `--background`            | `#F6F6FA`                                         | `#1A1B22`                                         |
| `--foreground`            | `#14161B`                                         | `#F2F3F7`                                         |
| `--card` / `--popover`    | `#FFFFFF`                                         | `#23252E`                                         |
| `--primary`               | `#6C5CE7`                                         | `#6C5CE7`                                         |
| `--primary-foreground`    | `#FFFFFF`                                         | `#FFFFFF`                                         |
| `--secondary` / `--muted` | `#EEEEF5`                                         | `#2B2D38`                                         |
| `--muted-foreground`      | `#6B6F80`                                         | `#9A9EB0`                                         |
| `--accent`                | `#EDEAFC`                                         | `#2C2846`                                         |
| `--accent-foreground`     | `#5642D6`                                         | `#B3A6FF`                                         |
| `--destructive`           | `#E14F4F`                                         | `#FF6B6B`                                         |
| `--success`               | `#1FAE8C`                                         | `#22D3A6`                                         |
| `--warning`               | `#F97316`                                         | `#FB923C`                                         |
| `--border` / `--input`    | `#E3E3EC`                                         | `#363845`                                         |
| `--ring`                  | `rgba(108,92,231,.45)`                            | `rgba(108,92,231,.5)`                             |
| `--chart-1…5`             | `#6C5CE7` `#1FAE8C` `#E14F4F` `#6B6F80` `#A99BFF` | `#6C5CE7` `#22D3A6` `#FF6B6B` `#8B8FA3` `#A99BFF` |

O escuro é **slate/índigo, não preto** (`#1A1B22`) — o quase-preto cansava a
vista em uso prolongado.

### 2.2 Temas prontos (o usuário escolhe)

Cada tema troca só fundo, superfícies e cor de destaque. **Status não muda de
tema** (verde/vermelho/laranja significam a mesma coisa em qualquer um) — por
isso não existe tema vermelho; o Bordô dá o tom avermelhado sem competir com
alerta.

| Tema    | Tipo   | `--primary` | `--background` | `--card`  | `--muted` | `--muted-foreground` | `--accent` | `--border` |
| ------- | ------ | ----------- | -------------- | --------- | --------- | -------------------- | ---------- | ---------- |
| Índigo  | claro  | `#6C5CE7`   | `#F6F6FA`      | `#FFFFFF` | `#EEEEF5` | `#6B6F80`            | `#EDEAFC`  | `#E3E3EC`  |
| Noite   | escuro | `#6C5CE7`   | `#1A1B22`      | `#23252E` | `#2B2D38` | `#9A9EB0`            | `#2C2846`  | `#363845`  |
| Rosa    | claro  | `#D6457F`   | `#FBF4F7`      | `#FFFFFF` | `#F6E8EF` | `#7A6670`            | `#FBE3EE`  | `#EEDDE5`  |
| Menta   | claro  | `#0F766E`   | `#F2F7F6`      | `#FFFFFF` | `#E4EFEC` | `#5F716D`            | `#D9F0EA`  | `#D8E6E2`  |
| Oceano  | claro  | `#2563EB`   | `#F3F6FB`      | `#FFFFFF` | `#E7EDF7` | `#64708A`            | `#E0EAFD`  | `#DCE3EF`  |
| Grafite | escuro | `#D4D4D8`   | `#1C1C1F`      | `#26262A` | `#2F2F34` | `#A1A1AA`            | `#35353B`  | `#3A3A41`  |
| Bordô   | escuro | `#B83A5E`   | `#1E1618`      | `#281D20` | `#33252A` | `#B39AA3`            | `#3D2229`  | `#42303A`  |

Implementação: `next-themes` com `attribute="class"` e a lista de ids;
cada tema é uma classe no `<html>` (`.rose`, `.mint`…). Temas escuros ativam
a variante `dark:` com
`@custom-variant dark (&:is(.dark *, .graphite *, .burgundy *));`.
O tema escolhido fica salvo na conta do usuário.

### 2.3 Cores de status e prioridade (fixas, iguais em todo tema)

**Prioridade** — faixa lateral do card (`w-1`) e pílula:

| Prioridade | Faixa               | Pílula                                                  |
| ---------- | ------------------- | ------------------------------------------------------- |
| Baixa      | `bg-border` (cinza) | `bg-muted text-muted-foreground`                        |
| Média      | `bg-blue-500`       | `bg-blue-500/15 text-blue-700 dark:text-blue-400`       |
| Alta       | `bg-orange-500`     | `bg-orange-500/15 text-orange-800 dark:text-orange-400` |
| Urgente    | `bg-red-500`        | `bg-red-500/15 text-red-700 dark:text-red-400`          |

**Status** (chamado/tarefa):

| Status                | Pílula                                                     |
| --------------------- | ---------------------------------------------------------- |
| Aberto                | `bg-blue-500/15 text-blue-700 dark:text-blue-400`          |
| Em andamento          | `bg-orange-500/15 text-orange-800 dark:text-orange-400`    |
| Resolvido / Concluído | `bg-emerald-500/15 text-emerald-700 dark:text-emerald-400` |
| Fechado / Sem prazo   | `bg-muted text-muted-foreground`                           |
| Atrasado              | `bg-destructive/15 text-destructive font-medium`           |

Regra: **cor comunica significado** (verde = concluído, vermelho = atrasado,
laranja = alta) em vez de tudo cinza. Pílulas sempre no formato
"fundo da cor a 15% + texto da cor escura", sem borda.

**Gráficos** (recharts) reaproveitam essas mesmas cores; magnitude de uma
métrica só usa `var(--primary)`. Nunca inventar paleta nova pra um gráfico.

### 2.4 Menu lateral colorido

O fundo do menu é **um tom escuro da cor principal do tema**, calculado — não
precisa definir por tema (só o Grafite sobrescreve, porque o primary dele é
cinza claro):

```css
--sidebar: color-mix(in oklab, var(--primary) 78%, black);
--sidebar-foreground: #ffffff;
--sidebar-muted: rgba(255, 255, 255, 0.72); /* itens inativos, rótulos */
--sidebar-accent: rgba(255, 255, 255, 0.14); /* item ativo */
--sidebar-hover: rgba(255, 255, 255, 0.08);
--sidebar-border: rgba(255, 255, 255, 0.12);
/* .graphite { --sidebar: #141416; } */
```

No menu, o logo usa **sempre a versão para fundo escuro** (branca).

## 3. Forma, espaçamento e sombra

| Item                           | Valor                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Raio base `--radius`           | `0.75rem` (12px) → `sm` 8px · `md` 10px · `lg` 12px · `xl` 16px                    |
| Card                           | `rounded-xl border shadow-sm py-6`, conteúdo `px-6`, `gap-6` interno               |
| Botão / input                  | `rounded-md`, altura **h-9** (padrão), **h-8** (sm), **h-10** (lg); ícone `size-9` |
| Pílula/badge                   | `rounded-md px-2 py-0.5 text-xs font-medium`                                       |
| Contador (ex: entregas do dia) | `rounded-full min-w-5 px-1.5 text-[11px] leading-4`                                |
| Sombra                         | só `shadow-xs` (botão) / `shadow-sm` (card) / `shadow-lg` (barra flutuante)        |
| Foco                           | `focus-visible:ring-[3px] ring-ring/50` (anel na cor primária translúcida)         |
| Barra de rolagem               | fina e na cor do tema (`scrollbar-width: thin`, cor = `muted-foreground` a 35%)    |

## 4. Layout da aplicação

```
┌────────────┬──────────────────────────────────────────────┐
│  LOGO   🔔 │ [⇤]                         (salvando…)       │ ← h-14, border-b
├────────────┼──────────────────────────────────────────────┤
│ Início     │                                              │
│ Chamados   │   Conteúdo: mx-auto w-full max-w-* p-6       │
│ Projetos   │   flex-col gap-6                             │
│            │                                              │
│ GESTÃO   ▸ │                                              │
│ ADMIN    ▸ │                                              │
│            │                                              │
│ ────────── │                                              │
│ (o) Nome ⇅ │                                ( ? A− A+ 🎨 )│ ← barra flutuante
│ Versão x.y │                                              │
└────────────┴──────────────────────────────────────────────┘
   w-60 (240px)
```

**Menu lateral**

- Largura **`w-60` (240px)**, `sticky top-0 h-screen`, só a partir de `md`.
- Topo **`h-14`** com `border-b` — mesma altura da barra do topo da página,
  pra formar uma faixa contínua. Logo **centralizado** (`h-8`), sino de
  notificações à direita.
- Área dos links: `px-3 py-4`, grupos com `gap-5` entre si e `gap-0.5` entre itens.
- Item: **`h-9 px-3 gap-3 rounded-md text-sm`**, ícone **18px** (`size-[18px]`,
  `strokeWidth={1.75}`). Ativo = `bg-sidebar-accent font-medium`; inativo =
  `text-sidebar-muted`, hover `bg-sidebar-hover`.
- Grupos: o primeiro (dia a dia) sem rótulo; os demais com rótulo em
  maiúsculas e **seta ▸ que abre/fecha** (lembrado no navegador; o grupo da
  página atual fica sempre aberto).
- Rodapé (`mt-auto border-t pt-3`): **cartão da conta** (avatar `size-8`, nome,
  papel, ícone ⇅) que abre um menu pra cima com nome + e-mail, Minha conta,
  Trocar senha e Sair. Embaixo, a versão (`text-xs`), que abre o histórico de
  correções.
- **Botão de recolher** (ícone `PanelLeftClose`/`PanelLeftOpen`) no canto
  esquerdo da barra do topo; escolha salva em cookie (lido no servidor, sem
  piscar). Recolhido, o sino vai pro topo.
- **Celular (< `md`)**: sem menu fixo — botão ☰ no topo abre um painel lateral
  (Sheet, `w-64 p-4`) com o mesmo conteúdo e as mesmas cores.

**Barra do topo da página**: `h-14 border-b px-4 sm:px-6`, `justify-between`.

**Conteúdo da página**: `mx-auto flex w-full flex-1 flex-col gap-6 p-6`, com
largura máxima conforme o tipo de tela:

| Tela                                          | Largura                            |
| --------------------------------------------- | ---------------------------------- |
| Formulário / conta / tela estreita            | `max-w-lg` – `max-w-2xl`           |
| Lista/tabela (ex: Chamados)                   | `max-w-3xl`                        |
| Telas de gestão (lista de projetos, usuários) | `max-w-5xl` – `max-w-6xl`          |
| Dashboard / visão ampla                       | `max-w-7xl` (`gap-8`)              |
| Quadro Kanban                                 | largura total (rola na horizontal) |

**Cabeçalho de página**: título (`font-display text-2xl`) + subtítulo
`text-sm text-muted-foreground` à esquerda; ações (botão primário + botões
`outline`) à direita, `flex-wrap` pra quebrar no celular.

**Barra flutuante** (canto inferior direito, `fixed right-4 bottom-4`): pílula
`bg-card rounded-full border p-1 shadow-lg` com Ajuda (tour), A−, A+ e
seletor de tema; botões `size-9 rounded-full`, separados por um traço
`h-5 w-px bg-border`.

## 5. Ícones

- Biblioteca única: **lucide-react**.
- Menu: **18px**, `strokeWidth 1.75`. Botões: **16px** (`size-4`, automático
  no `Button`). Badges: **12px** (`size-3`).
- Ícone acompanha texto (`gap-2` no botão, `gap-3` no menu). Botão só de ícone
  sempre com `aria-label` e `title`.

## 6. Componentes e padrões de tela

- **Botões**: primário (`default`) pra ação principal da tela — um só;
  `outline` pras secundárias; `ghost` pra ações discretas em linha/cabeçalho;
  `destructive` só pra apagar.
- **Tabela** como padrão pra filas/listas operacionais (testado Kanban pra
  chamados, usuário preferiu tabela). Nomes de pessoa na tabela: **primeiro e
  último nome** + avatar `size-5`, nome completo no `title`.
- **Filtros em pílulas** acima da tabela: "Todos 2 · Aberto 0 · …" (pílula
  ativa = `bg-primary text-primary-foreground`), busca com ícone de lupa
  embaixo.
- **Lista simples** (tela inicial, "Chamados com você"): `ul rounded-lg border
p-1`, cada linha `rounded-md px-3 py-2.5 text-sm hover:bg-accent/50`.
  Vazio: `rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground`.
- **Card de tarefa (Kanban), estilo Trello — resumido**: faixa lateral de
  prioridade, etiquetas como faixinhas coloridas, título, prazo em pílula
  colorida e só o avatar do responsável. Detalhe fica dentro da tarefa.
- **Dialogs grandes usam abas** (Detalhes / Atividade / Anexos) em vez de
  empilhar seção. Dialog de registro com muitas propriedades: **duas colunas**
  (conteúdo à esquerda, propriedades numa barra à direita que **salvam na
  hora**, sem botão Salvar).
- **Cards com título + selos**: selos numa linha **embaixo** do título
  (`flex flex-wrap gap-1.5`), nunca disputando a mesma linha com um nome que
  pode ser longo.
- **Gráficos de barra longos**: mostram as 8 maiores, com "Mostrar todos (N)"
  e um botão de ampliar que abre o gráfico inteiro numa janela.
- **Feedback**: toast (`sonner`) pra confirmação/erro; nunca mostrar erro
  técnico do servidor direto pro usuário.
- **Identidade da empresa** (nome, logo claro, logo escuro, ícone) vem de
  configuração no painel admin, não fixa no código.

## 7. `globals.css` do projeto de origem (tema padrão)

Só referência — **não copiar para cá**: os tokens deste projeto vivem em
`apps/web/app/assets/css/tokens.css`. No original, os outros temas ficam nos
blocos `.rose`, `.mint`, `.ocean`, `.graphite` e `.burgundy` (valores na tabela
da seção 2.2).

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *, .graphite *, .burgundy *));

:root {
  --radius: 0.75rem;
  --background: #f6f6fa;
  --foreground: #14161b;
  --card: #ffffff;
  --card-foreground: #14161b;
  --popover: #ffffff;
  --popover-foreground: #14161b;
  --primary: #6c5ce7;
  --primary-foreground: #ffffff;
  --secondary: #eeeef5;
  --secondary-foreground: #14161b;
  --muted: #eeeef5;
  --muted-foreground: #6b6f80;
  --accent: #edeafc;
  --accent-foreground: #5642d6;
  --destructive: #e14f4f;
  --destructive-foreground: #ffffff;
  --success: #1fae8c;
  --success-foreground: #0b2a22;
  --warning: #f97316;
  --warning-foreground: #431407;
  --border: #e3e3ec;
  --input: #e3e3ec;
  --ring: rgba(108, 92, 231, 0.45);
  --chart-1: #6c5ce7;
  --chart-2: #1fae8c;
  --chart-3: #e14f4f;
  --chart-4: #6b6f80;
  --chart-5: #a99bff;
  --sidebar: color-mix(in oklab, var(--primary) 78%, black);
  --sidebar-foreground: #ffffff;
  --sidebar-muted: rgba(255, 255, 255, 0.72);
  --sidebar-accent: rgba(255, 255, 255, 0.14);
  --sidebar-hover: rgba(255, 255, 255, 0.08);
  --sidebar-border: rgba(255, 255, 255, 0.12);
}

.dark {
  --background: #1a1b22;
  --foreground: #f2f3f7;
  --card: #23252e;
  --card-foreground: #f2f3f7;
  --popover: #23252e;
  --popover-foreground: #f2f3f7;
  --primary: #6c5ce7;
  --primary-foreground: #ffffff;
  --secondary: #2b2d38;
  --secondary-foreground: #f2f3f7;
  --muted: #2b2d38;
  --muted-foreground: #9a9eb0;
  --accent: #2c2846;
  --accent-foreground: #b3a6ff;
  --destructive: #ff6b6b;
  --destructive-foreground: #2a0e0e;
  --success: #22d3a6;
  --success-foreground: #0b2a22;
  --warning: #fb923c;
  --warning-foreground: #431407;
  --border: #363845;
  --input: #363845;
  --ring: rgba(108, 92, 231, 0.5);
  --chart-1: #6c5ce7;
  --chart-2: #22d3a6;
  --chart-3: #ff6b6b;
  --chart-4: #8b8fa3;
  --chart-5: #a99bff;
}

.dark,
.graphite,
.burgundy {
  color-scheme: dark;
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-muted: var(--sidebar-muted);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-hover: var(--sidebar-hover);
  --color-sidebar-border: var(--sidebar-border);

  --font-sans: var(--font-manrope);
  --font-display: var(--font-sora);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklab, var(--muted-foreground) 35%, transparent) transparent;
  }
  html {
    font-size: 106.25%;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```
