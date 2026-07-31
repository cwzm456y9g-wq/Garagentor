import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SearchResponse } from '@garagentor/shared';
import { SearchService } from './search.service';

@ApiTags('Suche')
@ApiBearerAuth('bearer')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Globale Suche über Kunden, Toranlagen, Belege, Artikel und Prüfungen',
  })
  find(@Query('q') q = '', @Query('limit') limit?: string): Promise<SearchResponse> {
    return this.search.search(q, limit ? Number.parseInt(limit, 10) : undefined);
  }
}
