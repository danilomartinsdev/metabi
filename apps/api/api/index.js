// Função serverless da Vercel: todo /api/* chega aqui (rewrite no vercel.json) e é repassado à mesma aplicação NestJS
// (Fastify) usada no Docker. A aplicação é criada uma vez por instância e reaproveitada entre requisições.
import 'reflect-metadata';
import { criarApp } from '../dist/app.factory.js';

let pronto;

async function iniciar() {
  const app = await criarApp();
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return fastify;
}

export default async function handler(req, res) {
  pronto ??= iniciar().catch((e) => {
    pronto = undefined;
    // Sem isto a Vercel mostra só FUNCTION_INVOCATION_FAILED; a mensagem lista nomes de variáveis, nunca valores.
    console.error('Falha ao iniciar a API:', e instanceof Error ? e.message : e);
    throw e;
  });
  const fastify = await pronto;
  fastify.server.emit('request', req, res);
}
