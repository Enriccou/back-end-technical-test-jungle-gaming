import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  CreateWalletRequest,
  WalletResponse,
  WalletLedgerResponse,
  ReconciliationRequest,
  ReconciliationResponse,
} from '@/application/dto';
import { WalletService } from '@/application/services/wallet.service';
import { JwtGuard } from '@/infrastructure/guards/jwt.guard';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: any,
    @Body() dto: CreateWalletRequest,
  ): Promise<WalletResponse> {
    const tokenPlayerId = req.user.sub;
    if (dto.playerId !== tokenPlayerId) {
      throw new ForbiddenException('Cannot create wallet for other player');
    }
    return this.walletService.createWallet(dto);
  }

  @Get(':walletId')
  @UseGuards(JwtGuard)
  async getWallet(
    @Request() req: any,
    @Param('walletId') walletId: string,
  ): Promise<WalletResponse> {
    return this.walletService.getWallet(walletId);
  }

  @Get(':walletId/ledger')
  @UseGuards(JwtGuard)
  async getLedger(
    @Param('walletId') walletId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 50,
  ): Promise<WalletLedgerResponse> {
    return this.walletService.getLedger(walletId, cursor, limit);
  }

  @Post(':walletId/reconciliation')
  @UseGuards(JwtGuard)
  async reconcile(
    @Param('walletId') walletId: string,
    @Body() dto: ReconciliationRequest,
  ): Promise<ReconciliationResponse> {
    return this.walletService.reconcile(walletId, dto);
  }
}
