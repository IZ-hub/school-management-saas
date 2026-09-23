import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterSchoolDto } from './dto/register-school.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('schools/register')
  async registerSchool(@Body() dto: RegisterSchoolDto) {
    return this.authService.registerSchool(dto);
  }
}
