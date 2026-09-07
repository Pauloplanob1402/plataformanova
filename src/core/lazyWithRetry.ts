import { lazy } from 'react';
import type { ComponentType } from 'react';

/**
 * Substitui o `lazy(() => import(...))` normal do React por uma versão que
 * se recupera sozinha do erro mais comum de apps com carregamento sob
 * demanda: depois de um novo deploy, os arquivos JS de cada tela ganham
 * nomes novos (hash no nome) e os antigos somem do servidor. Se alguém
 * estava com o site aberto DESDE ANTES do deploy e toca num jogo, o
 * navegador tenta buscar o arquivo antigo — que não existe mais — e a
 * importação falha ("Failed to fetch dynamically imported module").
 *
 * Sem tratamento nenhum, isso trava a tela pra sempre até a pessoa apertar
 * F5 na mão. Com isso aqui: na primeira falha, recarrega a página sozinho
 * (silenciosamente, uma vez só — a flag na sessionStorage evita loop
 * infinito caso o erro seja outra coisa) — o usuário nem percebe, só vê a
 * página recarregar rapidinho e o jogo abrir normalmente na tentativa
 * seguinte, já com os arquivos certos da versão nova.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = 'chunk-reload-attempted';
    try {
      const mod = await factory();
      // sucesso — limpa a flag pra próxima falha (se houver, no futuro) poder recarregar de novo
      window.sessionStorage.removeItem(storageKey);
      return mod;
    } catch (error) {
      const alreadyTried = window.sessionStorage.getItem(storageKey) === 'true';
      if (!alreadyTried) {
        window.sessionStorage.setItem(storageKey, 'true');
        window.location.reload();
        // nunca resolve — a página já está recarregando
        return new Promise<{ default: T }>(() => {});
      }
      // já tentou recarregar uma vez e continua falhando — é outro tipo de
      // erro (ex.: sem internet mesmo); deixa o erro subir normalmente
      throw error;
    }
  });
}
