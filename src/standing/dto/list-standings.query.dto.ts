import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListStandingsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
