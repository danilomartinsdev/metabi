import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthGuard } from './common/auth/auth.guard.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { ConfigModule } from './config/config.module.js';
import { ArquivosModule } from './modules/arquivos/arquivos.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { MailModule } from './modules/mail/mail.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { CadastrosModule } from './modules/cadastros/cadastros.module.js';
import { ImportModule } from './modules/import/import.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ExportModule } from './modules/export/export.module.js';
import { FaturamentoModule } from './modules/faturamento/faturamento.module.js';
import { NotasFiscaisModule } from './modules/notas-fiscais/notas-fiscais.module.js';
import { PedidosModule } from './modules/pedidos/pedidos.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

const dev = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'test' ? 'silent' : dev ? 'debug' : 'info',
        // O id vem do Fastify (genReqId em app.factory.ts); o header x-request-id é devolvido no onSend.
        genReqId: (req) => String((req as { id?: string }).id ?? randomUUID()),
        // Loga só o essencial: nunca headers (Authorization, Cookie), corpo ou query completa.
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url.split('?')[0],
          }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
        redact: { paths: ['req.headers', 'res.headers'], remove: true },
        transport:
          dev && process.env.NODE_ENV !== 'test'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    ConfigModule,
    PrismaModule,
    AuditModule,
    ArquivosModule,
    MailModule,
    AuthModule,
    UsuariosModule,
    PedidosModule,
    CadastrosModule,
    ImportModule,
    DashboardModule,
    ExportModule,
    FaturamentoModule,
    NotasFiscaisModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
