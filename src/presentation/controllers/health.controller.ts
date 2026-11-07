import { Controller, Get } from '@nestjs/common';
import { HealthResponse, ReadinessResponse } from '@/application/dto';

@Controller('health')
export class HealthController {
  @Get('live')
  live(): HealthResponse {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    // TODO: Check PostgreSQL and SQS connectivity
    return {
      ready: true,
      checks: {
        database: true,
        sqs: true,
      },
    };
  }
}
