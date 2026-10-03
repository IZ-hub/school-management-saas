import { Controller, Get, Post, Body, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Puts the refresh token in the httpOnly cookie; the body only carries the user and access token. */
  private respond(res: Response, session: { user: object; accessToken: string; refreshToken: string }) {
    setSessionCookie(res, session.refreshToken);
    return { data: { user: session.user, accessToken: session.accessToken } };
  }

  @Post('auth/login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.authService.login(dto));
  }

  @Post('schools/register')
  async registerSchool(@Body() dto: RegisterSchoolDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.authService.registerSchool(dto));
  }

  /** Issues a fresh access token while the refresh cookie is valid. */
  @Post('auth/refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.respond(res, await this.authService.refresh(readSessionCookie(req)));
    } catch (err) {
      clearSessionCookie(res);
      throw err;
    }
  }

  /** Public: details for a parent's setup link. */
  @Get('auth/invite')
  async getInvite(@Query('code') code = '') {
    return { data: await this.authService.getInvite(code) };
  }

  /** Public: a parent sets their password from the setup link and is signed in. */
  @Post('auth/accept-invite')
  async acceptInvite(@Body() dto: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.authService.acceptInvite(dto.code, dto.password));
  }

  @Post('auth/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(readSessionCookie(req));
    clearSessionCookie(res);
    return { data: { signedOut: true } };
  }
}
