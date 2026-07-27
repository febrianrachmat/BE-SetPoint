import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Service and database health check' })
  @ApiOkResponse({ description: 'Health payload wrapped in API envelope' })
  getHealth() {
    return this.appService.getHealth();
  }
}
