import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Räumt abgelaufene Refresh-Tokens nächtlich ab. */
@Injectable()
class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(private readonly auth: AuthService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    const removed = await this.auth.purgeExpiredTokens();
    if (removed > 0) {
      this.logger.log(`${removed} abgelaufene Refresh-Tokens entfernt`);
    }
  }
}

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    TokenCleanupTask,
    // Beide Guards gelten global: erst Authentifizierung, dann Rollenprüfung.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
