import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser, LoginResponse } from '@garagentor/shared';
import type { Request } from 'express';
import { AuthService, type ClientContext } from './auth.service';
import { CurrentUser, Public } from './decorators/auth.decorators';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/auth.dto';

@ApiTags('Authentifizierung')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anmelden und Tokenpaar erhalten' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponse> {
    return this.auth.login(dto, clientContext(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access-Token über den Refresh-Token erneuern' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<LoginResponse> {
    return this.auth.refresh(dto.refreshToken, clientContext(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sitzung beenden und Refresh-Token entwerten' })
  logout(@Body() dto: RefreshDto): Promise<{ success: true }> {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Angemeldeten Benutzer abrufen' })
  me(@CurrentUser('id') userId: string): Promise<AuthUser> {
    return this.auth.me(userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Eigenes Passwort ändern; beendet alle Sitzungen' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    return this.auth.changePassword(userId, dto);
  }
}

function clientContext(req: Request): ClientContext {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ipAddress: req.ip,
  };
}
