import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { CustomersService } from './customers.service';
import {
  CreateAddressDto,
  CreateContactDto,
  CreateCustomerDto,
  CreateSiteDto,
  CustomerQueryDto,
  UpdateAddressDto,
  UpdateContactDto,
  UpdateCustomerDto,
  UpdateSiteDto,
} from './dto/customer.dto';

@ApiTags('Kunden')
@ApiBearerAuth('bearer')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Kunden auflisten und durchsuchen' })
  findAll(@Query() query: CustomerQueryDto) {
    return this.customers.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kunde mit Adressen, Ansprechpartnern und Objekten' })
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Umsatz und offene Posten des Kunden' })
  statistics(@Param('id') id: string) {
    return this.customers.statistics(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Kunde anlegen; die Kundennummer wird vergeben' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Kunde ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Kunde löschen; mit Belegen wird er nur deaktiviert' })
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }

  /* Adressen ----------------------------------------------------------- */

  @Post(':id/addresses')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Adresse hinzufügen' })
  addAddress(@Param('id') id: string, @Body() dto: CreateAddressDto) {
    return this.customers.addAddress(id, dto);
  }

  @Patch(':id/addresses/:addressId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Adresse ändern' })
  updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customers.updateAddress(id, addressId, dto);
  }

  @Delete(':id/addresses/:addressId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Adresse entfernen' })
  removeAddress(@Param('id') id: string, @Param('addressId') addressId: string) {
    return this.customers.removeAddress(id, addressId);
  }

  /* Ansprechpartner ---------------------------------------------------- */

  @Post(':id/contacts')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Ansprechpartner hinzufügen' })
  addContact(@Param('id') id: string, @Body() dto: CreateContactDto) {
    return this.customers.addContact(id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Ansprechpartner ändern' })
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.customers.updateContact(id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Ansprechpartner entfernen' })
  removeContact(@Param('id') id: string, @Param('contactId') contactId: string) {
    return this.customers.removeContact(id, contactId);
  }

  /* Objekte ------------------------------------------------------------ */

  @Post(':id/sites')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Objekt anlegen' })
  addSite(@Param('id') id: string, @Body() dto: CreateSiteDto) {
    return this.customers.addSite(id, dto);
  }

  @Patch(':id/sites/:siteId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Objekt ändern' })
  updateSite(@Param('id') id: string, @Param('siteId') siteId: string, @Body() dto: UpdateSiteDto) {
    return this.customers.updateSite(id, siteId, dto);
  }

  @Delete(':id/sites/:siteId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Objekt löschen; mit Toranlagen wird es nur deaktiviert' })
  removeSite(@Param('id') id: string, @Param('siteId') siteId: string) {
    return this.customers.removeSite(id, siteId);
  }
}
