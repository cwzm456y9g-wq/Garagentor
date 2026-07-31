import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { EntityType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { DocumentsService } from './documents.service';
import { DocumentQueryDto, UpdateDocumentDto, UploadDocumentDto } from './dto/document.dto';

@ApiTags('Dokumente')
@ApiBearerAuth('bearer')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Dokumente auflisten und filtern' })
  findAll(@Query() query: DocumentQueryDto) {
    return this.documents.findAll(query);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Alle Dokumente einer Entität, z. B. eines Auftrags' })
  forEntity(@Param('entityType') entityType: EntityType, @Param('entityId') entityId: string) {
    return this.documents.forEntity(entityType, entityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Metadaten eines Dokuments' })
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Datei herunterladen' })
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { path, document } = await this.documents.fileFor(id);

    res.set({
      'Content-Type': document.mimeType,
      'Content-Length': `${document.size}`,
      // Der Dateiname wird kodiert, damit Umlaute korrekt ankommen.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        document.originalName,
      )}`,
    });
    this.documents.createReadStream(path).pipe(res);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        category: { type: 'string' },
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Datei hochladen und einer Entität zuordnen' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.documents.upload(file, dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Metadaten ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documents.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dokument samt Datei löschen' })
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }
}
