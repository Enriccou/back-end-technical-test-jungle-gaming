import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { JwtModule } from '@nestjs/jwt';

import { HealthController } from './presentation/controllers/health.controller';
import { WalletsController } from './presentation/controllers/wallets.controller';
import { WageringsController } from './presentation/controllers/wagerings.controller';
import { AuthController } from './presentation/controllers/auth.controller';

import { WalletService } from './application/services/wallet.service';
import { WagerTransactionService } from './application/services/wager-transaction.service';
import { IdempotencyService } from './application/services/idempotency.service';

// Entities for MikroORM
import { WalletEntity } from './infrastructure/database/entities/WalletEntity';
import { WagerTransactionEntity } from './infrastructure/database/entities/WagerTransactionEntity';
import { WalletLedgerEntryEntity } from './infrastructure/database/entities/WalletLedgerEntryEntity';
import { InboxMessageEntity } from './infrastructure/database/entities/InboxMessageEntity';
import { OutboxMessageEntity } from './infrastructure/database/entities/OutboxMessageEntity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') },
      }),
    }),
    MikroOrmModule.forRootAsync({
      useFactory: () => {
        const dbUrl = new URL(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/jungle_gaming');
        return {
          driver: PostgreSqlDriver,
          autoLoadEntities: true,
          entities: [
            WalletEntity,
            WagerTransactionEntity,
            WalletLedgerEntryEntity,
            InboxMessageEntity,
            OutboxMessageEntity,
          ],
          dbName: dbUrl.pathname.slice(1),
          user: dbUrl.username,
          password: dbUrl.password,
          host: dbUrl.hostname,
          port: dbUrl.port ? parseInt(dbUrl.port, 10) : 5432,
          migrations: {
            path: 'dist/infrastructure/database/migrations',
            pathTs: 'src/infrastructure/database/migrations',
          },
        };
      },
    }),
  ],
  controllers: [HealthController, AuthController, WalletsController, WageringsController],
  providers: [WalletService, WagerTransactionService, IdempotencyService],
})
export class AppModule {}
