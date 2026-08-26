/**
 * Envolve uma chamada de rede (RPC do Supabase, etc.) com um limite de tempo.
 * Sem isso, se a conexão cair ou a resposta nunca chegar, o `await` fica
 * pendurado pra sempre — e como os jogos usam esse resultado pra liberar o
 * botão de novo (`setBusy(false)`), a tela inteira parece travada, sem
 * nenhum aviso de erro pro jogador.
 *
 * Com o timeout, depois de `ms` milissegundos sem resposta a Promise rejeita
 * com um erro claro — o jogo então mostra a mensagem de erro normal e libera
 * os botões de novo, em vez de ficar preso pra sempre.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Tempo esgotado. Verifique sua conexão e tente de novo.'));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Mesma proteção acima, mas devolvendo o formato { data, error } que o
 * cliente Supabase já usa — assim os jogos não precisam de try/catch extra,
 * só trocar `await supabase.rpc(...)` por `await safeRpc(supabase.rpc(...))`.
 * Se estourar o tempo (ou qualquer outro erro de rede), cai no mesmo
 * caminho de erro que já existia — mostra a mensagem e libera os botões.
 */
export async function safeRpc<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ms = 15000,
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    return await withTimeout(promise, ms);
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Erro de rede.' } };
  }
}
