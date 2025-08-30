import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { UsersService } from './users.service';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CustomLoggerService } from '../../common/logger';
import { Response } from 'express';

class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class SignInDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext('UsersController');
  }

  @Post('sign-up')
  async signUp(@Body() body: SignUpDto, @Res({ passthrough: true }) res: Response) {
    this.logger.debug('Sign-up attempt', { body: this.logger.redact(body) });
    const result = await this.usersService.signUp(body);
    this.setAuthCookie(res, result.accessToken);
    this.logger.log('Sign-up success', { userId: result.user.id, email: result.user.email });
    return result;
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: SignInDto, @Res({ passthrough: true }) res: Response) {
    this.logger.debug('Sign-in attempt', { body: this.logger.redact(body) });
    const result = await this.usersService.signIn(body);
    this.setAuthCookie(res, result.accessToken);
    this.logger.log('Sign-in success', { userId: result.user.id, email: result.user.email });
    return result;
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  async signOut(@Res({ passthrough: true }) res: Response) {
    const cookieName = process.env.JWT_COOKIE_NAME || 'vc_access_token';
    res.clearCookie(cookieName, { path: '/' });
    return { success: true };
  }

  private setAuthCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieName = process.env.JWT_COOKIE_NAME || 'vc_access_token';
    const maxAgeMs = this.parseExpiresIn(process.env.JWT_EXPIRES_IN || '15m');
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });
  }

  private parseExpiresIn(expiresIn: string): number {
    // supports formats like 15m, 1h, 7d, 3600s
    const match = /^(\d+)([smhd])?$/.exec(expiresIn.trim());
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2] || 's';
    const multipliers: Record<string, number> = { s: 1000, m: 60 * 1000, h: 3600 * 1000, d: 24 * 3600 * 1000 };
    return value * (multipliers[unit] || 1000);
  }
}


