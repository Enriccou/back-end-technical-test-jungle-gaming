import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  SubmitWagerTransactionRequest,
  WagerTransactionResponse,
} from '@/application/dto';
import { WagerTransactionService } from '@/application/services/wager-transaction.service';
import { JwtGuard } from '@/infrastructure/guards/jwt.guard';

@Controller('wagering')
export class WageringsController {
  constructor(
    private readonly wagerTransactionService: WagerTransactionService,
  ) {}

  @Post('transactions')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Request() req: any,
    @Body() dto: SubmitWagerTransactionRequest,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<WagerTransactionResponse> {
    if (!idempotencyKey) {
      throw new Error('Idempotency-Key header is required');
    }

    const tokenPlayerId = req.user.sub;
    if (dto.playerId !== tokenPlayerId) {
      throw new ForbiddenException('Cannot bet for other player');
    }

    return this.wagerTransactionService.submitTransaction(dto, idempotencyKey);
  }

  @Get('transactions/:transactionId')
  async getTransaction(
    @Param('transactionId') transactionId: string,
  ): Promise<WagerTransactionResponse> {
    return this.wagerTransactionService.getTransaction(transactionId);
  }

  @Get('providers/:providerId/wagering/transactions/:externalTransactionId')
  async getTransactionByProvider(
    @Param('providerId') providerId: string,
    @Param('externalTransactionId') externalTransactionId: string,
  ): Promise<WagerTransactionResponse> {
    return this.wagerTransactionService.getTransactionByProvider(
      providerId,
      externalTransactionId,
    );
  }
}
