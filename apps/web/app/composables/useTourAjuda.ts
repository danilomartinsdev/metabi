import type { DriveStep } from 'driver.js';

interface PassoTour {
  /** Valor do atributo data-tour do elemento destacado. */
  alvo: string;
  titulo: string;
  texto: string;
  lado?: 'top' | 'right' | 'bottom' | 'left';
}

/** Ordem do guia. Passos cujo elemento não está visível na tela atual são pulados. */
export const PASSOS_TOUR: PassoTour[] = [
  {
    alvo: 'menu',
    titulo: 'Menu',
    texto: 'As telas que você pode acessar. Os grupos com seta abrem e fecham.',
    lado: 'right',
  },
  {
    alvo: 'novidades',
    titulo: 'Novidades',
    texto: 'O sino mostra o que mudou no sistema. Um ponto no sino indica novidade ainda não vista.',
  },
  {
    alvo: 'recolher-menu',
    titulo: 'Recolher o menu',
    texto: 'Deixa o menu só com ícones e sobra mais espaço para tabelas e gráficos.',
    lado: 'bottom',
  },
  {
    alvo: 'filtros',
    titulo: 'Filtros',
    texto:
      'Escolha o período e filtre os dados da tela. Os filtros vão para o endereço da página: copiando o link, outra pessoa abre a mesma visão.',
    lado: 'bottom',
  },
  {
    alvo: 'usuario',
    titulo: 'Sua conta',
    texto: 'Seu nome e papel. Clique para trocar a senha ou sair.',
    lado: 'right',
  },
  {
    alvo: 'fonte',
    titulo: 'Tamanho da letra',
    texto: 'A− diminui e A+ aumenta a letra de todas as telas. Fica salvo neste navegador.',
    lado: 'top',
  },
  {
    alvo: 'aparencia',
    titulo: 'Aparência',
    texto: 'Tema claro ou escuro, cores do sistema e cores dos gráficos.',
    lado: 'top',
  },
  {
    alvo: 'ajuda',
    titulo: 'Ajuda',
    texto: 'Clique aqui sempre que quiser rever este guia.',
    lado: 'top',
  },
];

function visivel(el: Element | null): el is HTMLElement {
  return !!el && el.getClientRects().length > 0;
}

/** Guia passo a passo pelas partes da tela (botão "?" da barra flutuante). */
export function useTourAjuda() {
  async function iniciar() {
    const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]);

    const steps: DriveStep[] = [];
    for (const p of PASSOS_TOUR) {
      // Pode haver o mesmo alvo em dois lugares (ex.: menu fixo e painel do celular): usa o visível.
      const el = [...document.querySelectorAll(`[data-tour="${p.alvo}"]`)].find(visivel);
      if (!el) continue;
      steps.push({ element: el, popover: { title: p.titulo, description: p.texto, side: p.lado } });
    }
    if (!steps.length) return;

    driver({
      steps,
      popoverClass: 'tour-meta',
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Próximo',
      prevBtnText: 'Voltar',
      doneBtnText: 'Concluir',
      stageRadius: 10,
      stagePadding: 6,
    }).drive();
  }

  return { iniciar };
}
