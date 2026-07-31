import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@garagentor/shared';
import { Role } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CurrentUser, Roles } from './decorators/auth.decorators';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/auth.dto';
import { UsersService, type SafeUser } from './users.service';

@ApiTags('Benutzer')
@ApiBearerAuth('bearer')
@Roles(Role.ADMIN, Role.GESCHAEFTSFUEHRUNG)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Benutzer auflisten' })
  findAll(@Query() query: PaginationQueryDto): Promise<Paginated<SafeUser>> {
    return this.users.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Benutzer abrufen' })
  findOne(@Param('id') id: string): Promise<SafeUser> {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Benutzer anlegen' })
  create(@Body() dto: CreateUserDto): Promise<SafeUser> {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Benutzer ändern' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actingUserId: string,
  ): Promise<SafeUser> {
    return this.users.update(id, dto, actingUserId);
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Passwort zurücksetzen; beendet alle Sitzungen des Benutzers' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: true }> {
    return this.users.resetPassword(id, dto.newPassword);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Benutzer deaktivieren (Datensatz bleibt erhalten)' })
  deactivate(@Param('id') id: string, @CurrentUser('id') actingUserId: string): Promise<SafeUser> {
    return this.users.deactivate(id, actingUserId);
  }
}
