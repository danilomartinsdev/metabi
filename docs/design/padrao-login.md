# Padrão da tela de login (referência)

> **Como vale neste projeto (2026-10-20):** a tela de login e as de senha (`layouts/auth.vue`,
> `pages/login.vue`) seguem este padrão — medidas, cartão, painel com degradê a partir do
> `--sidebar`, brilho com `--sidebar-destaque` (#01AFEF, azul-claro do logo) e miniatura desenhada.
> Diferenças deliberadas: fonte **Inter** (não Manrope/Sora, ver [padrao-visual.md](padrao-visual.md));
> letra base 100% (não 106,25%); **"Esqueci minha senha" fica**, porque aqui a função existe; botão
> "Entrar" na cor `--primary` do tema. Stack aqui é Nuxt UI v4, não shadcn.

Extraído da tela de login do Metahospitalar SAC em 2026-10-20
(`src/app/login/page.tsx` e `src/components/auth/login-form.tsx`).
Complementa o `padrao-visual.md` (seção 4, "Tela de login").

Stack de referência: **Next.js (App Router) + Tailwind v4 + shadcn/ui + lucide-react**.

```
┌──────────────────────── fundo --background ─────────────────────────┐
│  ┌──────────────────────────────┬────────────────────────────────┐  │
│  │            LOGO              │ ┌────────────────────────────┐ │  │
│  │                              │ │ Título grande (branco)     │ │  │
│  │      Bem-vindo de volta      │ │ frase de apoio             │ │  │
│  │      texto de apoio          │ │   ┌────────────────────────┤ │  │
│  │  [ E-mail              ]     │ │   │ miniatura do sistema   │ │  │
│  │  [ Senha            👁 ]     │ │   │ (menu, números, barras)│ │  │
│  │  [       Entrar        ]     │ │   │                        │ │  │
│  │      © ano · empresa         │ └───┴────────────────────────┘ │  │
│  └──────────────────────────────┴────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 1. Base

| Item              | Valor no SAC                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Fonte do corpo    | Manrope 400/500/600/700                                                                      |
| Fonte dos títulos | Sora 500/600/700 (`h1` e `h2` da tela)                                                       |
| Tamanho da letra  | `html { font-size: 106.25% }` (≈17px) — por isso um print do SAC mostra o cartão com ~1224px |
| Raio base         | 12px → `rounded-lg` 12px, `rounded-md` 10px, `rounded-xl` 16px                               |

## 2. Cores (tema Azul do SAC)

A tela só usa tokens, nenhuma cor fixa.

| Token (shadcn)            | Azul                  | Onde aparece                                  |
| ------------------------- | --------------------- | --------------------------------------------- |
| `--background`            | `#F3F5F8`             | fundo da página e do conteúdo da miniatura    |
| `--card`                  | `#FFFFFF`             | cartão, campos, cartões da miniatura          |
| `--foreground`            | `#172033`             | títulos e textos                              |
| `--muted-foreground`      | `#5B6477`             | subtítulo, rodapé, placeholder, ícone do olho |
| `--input`                 | `#CDD3DD`             | borda dos campos                              |
| `--border`                | `#E2E6EC`             | bordas da miniatura                           |
| `--ring`                  | `#0081B8`             | contorno do campo em foco                     |
| `--primary`               | `#113176`             | botão Entrar (hover `#0C255A`)                |
| `--sidebar`               | `#0B1F4A`             | base do degradê do painel e menu da miniatura |
| `--sidebar-accent`        | `#1D3470`             | item ativo do menu da miniatura               |
| `--sidebar-muted`         | `#8B9BC0`             | ícones e linhas do menu da miniatura          |
| destaque da marca         | `#01AFEF`             | brilho no canto do painel, a 25%              |
| `--destructive`           | `#B3261E`             | erro do login (fundo = mesma cor a 15%)       |
| `--success` / `--warning` | `#1D7F47` / `#9A6512` | números e linhas da miniatura                 |
| `--chart-1`               | `#2A78D6`             | barras da miniatura                           |

### Degradê do painel

```css
background: linear-gradient(150deg, oklch(from var(--sidebar) calc(l + 0.2) calc(c * 1.6) h), var(--sidebar));
```

- Clareia **e satura** o tom do menu em oklch. Clarear com `color-mix(..., white)` deixa o azul
  acinzentado — testado e descartado.
- Parte do `--sidebar` (escuro em todo tema), não do `--primary`: o texto branco fica legível em
  qualquer tema, inclusive nos de primary claro (Grafite).
- Aqui: classe `.painel-login` em `main.css`, com `--sidebar` liso de reserva para navegadores sem
  cor relativa.

## 3. Tamanhos

### Página e cartão

| Elemento | Classes                                                                                         | Em px                                                                 |
| -------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Página   | `flex min-h-screen items-center justify-center bg-background p-4 sm:p-8`                        | margem 16 (32 a partir de 640)                                        |
| Cartão   | `grid w-full max-w-6xl gap-3 rounded-3xl bg-card p-3 shadow-xl md:min-h-[640px] md:grid-cols-2` | máx. 1152, cantos 24, margem interna 12, duas colunas a partir de 768 |

### Coluna do formulário (tudo centralizado)

| Elemento            | Classes                                                                           | Em px                                                   |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Coluna              | `flex flex-col items-center px-4 pt-10 pb-6 sm:px-10`                             | 40 em cima, 24 embaixo, 40 nas laterais (16 no celular) |
| Logo                | `h-12 w-auto`                                                                     | 48 de altura                                            |
| Bloco do formulário | `flex w-full max-w-sm flex-1 flex-col justify-center py-10`                       | máx. 384                                                |
| Título              | `text-2xl sm:text-3xl font-semibold tracking-tight`, centralizado                 | 30 (24 no celular)                                      |
| Subtítulo           | `mt-2 text-sm text-muted-foreground`                                              | 14                                                      |
| Formulário          | `mt-8 space-y-4`                                                                  | 32 abaixo do subtítulo, 16 entre campos                 |
| Rótulo → campo      | `space-y-1.5`                                                                     | 6                                                       |
| Campo               | `h-10 rounded-lg border border-input bg-card px-3 text-sm`                        | 40 de altura, cantos 12                                 |
| Botão Entrar        | `h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground`   | 40 de altura                                            |
| Erro                | `rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive`, `role="alert"` | acima do botão                                          |
| Rodapé              | `text-xs text-muted-foreground`                                                   | 12, no fim da coluna                                    |

### Mostrar/ocultar senha

- Botão dentro do campo, à direita; ícone olho/olho cortado de 16px, `text-muted-foreground`.
- `type="button"`, `aria-label` e `title` "Mostrar senha" / "Ocultar senha", `aria-pressed`.

### Painel da direita (a partir de 768px)

| Elemento | Classes                                                                                              | Em px                                  |
| -------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Painel   | `relative hidden flex-col overflow-hidden rounded-2xl px-10 pt-12 text-white md:flex`, `aria-hidden` | cantos 16, 40 nas laterais, 48 em cima |
| Brilho   | `pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-3xl`, destaque a 25%       | círculo de 288 saindo 96 pelo canto    |
| Título   | `relative max-w-md text-3xl leading-tight font-semibold tracking-tight`                              | 30                                     |
| Texto    | `relative mt-4 max-w-md text-sm leading-relaxed text-white/75`                                       | 14                                     |

### Miniatura do sistema

| Elemento | Classes                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Janela   | `relative mt-10 -mr-16 flex flex-1 overflow-hidden rounded-t-xl bg-card text-foreground shadow-2xl ring-8 ring-white/15` (encosta embaixo, vaza 64 à direita) |
| Menu     | `w-24 shrink-0 flex-col gap-2.5 bg-sidebar p-3`; logo branco `h-4`, item ativo `h-5 rounded-md`, 4 linhas `h-1.5`                                             |
| Conteúdo | `flex-1 flex-col gap-3 bg-background p-4`; título `text-sm`, rótulo `text-[9px]`                                                                              |
| Números  | `grid grid-cols-4 gap-2`; cada um `rounded-md border bg-card px-2 py-1.5`, rótulo `text-[8px]`, valor `text-base font-semibold`                               |
| Gráfico  | `rounded-md border p-2.5`, área `h-16`, 12 barras `flex-1 rounded-t-[2px]`, `gap-1.5`                                                                         |
| Lista    | 3 linhas `px-2.5 py-2 border-b`: duas barrinhas, ponto `size-1.5` e traço `h-1` com cor de status                                                             |

**A miniatura é sempre desenhada, nunca print real**: a tela de login é pública e um print levaria
nomes de clientes e usuários. Números e textos fixos e genéricos; desenhada com tokens, acompanha o tema.

### Celular (abaixo de 768px)

O painel some (`hidden md:flex`); fica só o cartão com o formulário.

## 4. Textos

- Formulário: **"Bem-vindo de volta"** / "Use o e-mail e a senha fornecidos pelo administrador."
- Painel: título curto dizendo **o que o sistema é** + uma frase do que se faz nele. Nada genérico.
  - SAC: "SAC e assistência técnica em um só lugar." / "Registre as reclamações dos clientes,
    acompanhe cada CAT do atendimento à pesquisa de satisfação e cumpra os prazos do PQ-03 com todo
    o histórico guardado."
  - BI: "Vendas, metas e faturamento num só lugar." / "Indicadores, rankings de representantes e
    curvas ABC a partir dos pedidos e notas do Focco — cada pessoa vendo só os dados que lhe cabem."
- Rodapé: "© ano Empresa · Sistema" (ano calculado).
- Não colocar "Lembrar de mim", "Esqueci a senha" nem login social se o sistema não tiver a função.

O código-fonte de referência (React/shadcn) está no SAC: `src/app/login/page.tsx` e
`src/components/auth/login-form.tsx`.
