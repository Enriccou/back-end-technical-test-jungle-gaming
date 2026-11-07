import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService) {}

  @Post('token')
  async login(@Body() dto: { playerId: string; providerId: string }) {
    if (!dto.playerId || !dto.providerId) {
      throw new BadRequestException('playerId and providerId required');
    }

    const token = this.jwtService.sign({
      sub: dto.playerId,
      providerId: dto.providerId,
      iat: Math.floor(Date.now() / 1000),
    });

    return { access_token: token, token_type: 'Bearer' };
  }
}
