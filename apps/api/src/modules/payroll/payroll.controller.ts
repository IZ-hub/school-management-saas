import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { PayrollService, PayMethod } from './payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, PAYROLL_ROLES, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** Who may approve a payroll, reopen it, delete a draft or undo a payment: not the accountant who prepares it. */
const APPROVERS = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL'];

class PayItemDto {
  @IsString() @MaxLength(60) label: string;
  @IsNumber() @Min(0) @Max(100_000_000) amount: number;
}

class PersonPayDto {
  @IsNumber() @Min(0) @Max(100_000_000) basic: number;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PayItemDto) allowances: PayItemDto[];
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PayItemDto) deductions: PayItemDto[];
  @IsOptional() @IsString() @MaxLength(80) bankName?: string;
  @IsOptional() @IsString() @MaxLength(20) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) accountName?: string;
}

class SettingsDto {
  @ValidateIf((o) => o.latePenalty !== null) @IsNumber() latePenalty: number | null;
  @IsNumber() freeLates: number;
}

class CreateRunDto {
  @IsString() @Matches(/^\d{4}-\d{2}$/) month: string;
}

class LineDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PayItemDto) extraPay?: PayItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PayItemDto) extraDeductions?: PayItemDto[];
  @IsOptional() @IsBoolean() waiveLateness?: boolean;
  @IsOptional() @IsBoolean() excluded?: boolean;
}

class PayDto {
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) keys?: string[];
  @IsString() paidOn: string;
  @IsIn(['TRANSFER', 'CASH', 'CHEQUE']) method: PayMethod;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
}

class EmailDto {
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) keys?: string[];
}

class OtherStaffDto {
  @IsString() @MaxLength(60) firstName: string;
  @IsString() @MaxLength(60) lastName: string;
  @IsString() @MaxLength(60) role: string;
  @IsOptional() @IsString() @MaxLength(40) staffNumber?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @ValidateIf((o) => !!o.email) @IsEmail() email?: string;
}

/** Monthly payroll and payslips. Pay is only seen by the owner, principal and accountant; each person sees their own payslips. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PAYROLL_ROLES)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Get('settings')
  async settings(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.settings(user.schoolId) };
  }

  @Put('settings')
  async saveSettings(@CurrentUser() user: JwtPayload, @Body() dto: SettingsDto) {
    return { data: await this.service.saveSettings(user.schoolId, dto.latePenalty, dto.freeLates) };
  }

  @Get('people')
  async people(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.people(user.schoolId) };
  }

  @Put('people/:key')
  async savePerson(@CurrentUser() user: JwtPayload, @Param('key') key: string, @Body() dto: PersonPayDto) {
    this.service.assertKey(key);
    return { data: await this.service.savePerson(user.schoolId, key, dto) };
  }

  @Get('runs')
  async runs(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.runs(user.schoolId) };
  }

  @Post('runs')
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRunDto) {
    return { data: await this.service.create(user.schoolId, user, dto.month) };
  }

  @Get('runs/:month')
  async run(@CurrentUser() user: JwtPayload, @Param('month') month: string) {
    return { data: await this.service.run(user.schoolId, month) };
  }

  @Post('runs/:month/rebuild')
  async rebuild(@CurrentUser() user: JwtPayload, @Param('month') month: string) {
    return { data: await this.service.rebuild(user.schoolId, month) };
  }

  @Patch('runs/:month/lines/:key')
  async editLine(@CurrentUser() user: JwtPayload, @Param('month') month: string, @Param('key') key: string, @Body() dto: LineDto) {
    this.service.assertKey(key);
    return { data: await this.service.editLine(user.schoolId, month, key, dto) };
  }

  @Post('runs/:month/approve')
  @Roles(...APPROVERS)
  async approve(@CurrentUser() user: JwtPayload, @Param('month') month: string) {
    return { data: await this.service.approve(user.schoolId, user, month) };
  }

  @Post('runs/:month/reopen')
  @Roles(...APPROVERS)
  async reopen(@CurrentUser() user: JwtPayload, @Param('month') month: string) {
    return { data: await this.service.reopen(user.schoolId, month) };
  }

  @Delete('runs/:month')
  @Roles(...APPROVERS)
  async remove(@CurrentUser() user: JwtPayload, @Param('month') month: string) {
    return { data: await this.service.remove(user.schoolId, month) };
  }

  @Post('runs/:month/pay')
  async pay(@CurrentUser() user: JwtPayload, @Param('month') month: string, @Body() dto: PayDto) {
    return { data: await this.service.markPaid(user.schoolId, user, month, dto) };
  }

  @Post('runs/:month/lines/:key/unpay')
  @Roles(...APPROVERS)
  async unpay(@CurrentUser() user: JwtPayload, @Param('month') month: string, @Param('key') key: string) {
    this.service.assertKey(key);
    return { data: await this.service.unpay(user.schoolId, month, key) };
  }

  @Post('runs/:month/email')
  async email(@CurrentUser() user: JwtPayload, @Param('month') month: string, @Body() dto: EmailDto) {
    return { data: await this.service.emailPayslips(user.schoolId, month, dto.keys) };
  }

  /** Any staff member's own payslips. */
  @Get('my-payslips')
  @Roles(...STAFF_ROLES)
  async mine(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.myPayslips(user.schoolId, user) };
  }

  // Other staff (security, cleaners, drivers…): admins and the accountant keep the list.
  @Get('other-staff')
  @Roles(...ADMIN_ROLES, 'ACCOUNTANT')
  async otherStaff(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.otherStaff(user.schoolId) };
  }

  @Post('other-staff')
  @Roles(...ADMIN_ROLES, 'ACCOUNTANT')
  async addOther(@CurrentUser() user: JwtPayload, @Body() dto: OtherStaffDto) {
    return { data: await this.service.saveOtherStaff(user.schoolId, null, dto) };
  }

  @Put('other-staff/:id')
  @Roles(...ADMIN_ROLES, 'ACCOUNTANT')
  async editOther(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: OtherStaffDto) {
    return { data: await this.service.saveOtherStaff(user.schoolId, id, dto) };
  }

  @Delete('other-staff/:id')
  @Roles(...ADMIN_ROLES, 'ACCOUNTANT')
  async removeOther(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.removeOtherStaff(user.schoolId, id) };
  }
}
