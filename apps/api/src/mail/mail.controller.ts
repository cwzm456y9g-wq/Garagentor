import { Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MailDocumentType } from '@garagentor/shared';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { MailLogQueryDto, MailPreviewDto, SendMailDto } from './dto/mail.dto';
import { MailService } from './mail.service';

/**
 * Welche Rollen eine Belegart verschicken dürfen.
 *
 * Der Monteur soll den Bericht vom Einsatz mitschicken können, aber weder
 * Rechnungen noch Mahnungen – das ist dieselbe Grenze wie in der Buchhaltung.
 */
const VERSANDRECHTE: Record<MailDocumentType, Role[]> = {
  ANGEBOT: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
  RECHNUNG: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
  MAHNUNG: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
  SERVICEBERICHT: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
  PRUEFPROTOKOLL: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
};

@ApiTags('Postausgang')
@ApiBearerAuth('bearer')
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('status')
  @ApiOperation({ summary: 'Ob der Postausgang eingerichtet ist' })
  status() {
    return this.mail.status();
  }

  @Get()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Versandprotokoll' })
  findAll(@Query() query: MailLogQueryDto) {
    return this.mail.findAll(query);
  }

  @Post('vorschau')
  @ApiOperation({ summary: 'Anschreiben aus der Vorlage füllen, ohne zu verschicken' })
  vorschau(@Body() dto: MailPreviewDto, @CurrentUser('role') role: Role) {
    this.pruefeRecht(dto.art, role);
    return this.mail.vorschau(dto.art, dto.id);
  }

  @Post('senden')
  @ApiOperation({ summary: 'Beleg als PDF-Anhang verschicken und protokollieren' })
  senden(@Body() dto: SendMailDto, @CurrentUser('role') role: Role) {
    this.pruefeRecht(dto.art, role);
    return this.mail.senden(dto);
  }

  /**
   * Die Prüfung steht hier statt in @Roles(), weil das erlaubte Rollenbild von
   * der Belegart im Rumpf abhängt. Administratoren dürfen alles – dieselbe
   * Regel gilt im RolesGuard, und zwei verschiedene Antworten auf dieselbe
   * Frage wären nicht zu erklären.
   */
  private pruefeRecht(art: MailDocumentType, role: Role): void {
    if (role === Role.ADMIN || VERSANDRECHTE[art].includes(role)) return;

    throw new ForbiddenException('Für diese Belegart fehlt die erforderliche Berechtigung.');
  }
}
