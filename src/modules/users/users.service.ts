import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/User';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { CustomLoggerService } from '../../common/logger';

interface SignUpParams {
  email: string;
  password: string;
}

interface SignInParams {
  email: string;
  password: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly logger: CustomLoggerService,
  ) {}

  async signUp(params: SignUpParams) {
    const existing = await this.userRepository.findOne({ where: { email: params.email } });
    if (existing) {
      this.logger.warn('Sign-up conflict', { email: params.email });
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await argon2.hash(params.password);
    const user = this.userRepository.create({ email: params.email, passwordHash });
    await this.userRepository.save(user);
    this.logger.log('User created', { userId: user.id, email: user.email });
    return this.generateAuthResponse(user);
  }

  async signIn(params: SignInParams) {
    const user = await this.userRepository.findOne({ where: { email: params.email } });
    if (!user) {
      this.logger.warn('Sign-in failed: user not found', { email: params.email });
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await argon2.verify(user.passwordHash, params.password);
    if (!valid) {
      this.logger.warn('Sign-in failed: invalid password', { email: params.email });
      throw new UnauthorizedException('Invalid credentials');
    }
    this.logger.log('Sign-in success', { userId: user.id, email: user.email });
    return this.generateAuthResponse(user);
  }

  private async generateAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    return {
      user: { id: user.id, email: user.email },
      accessToken,
    };
  }
}


