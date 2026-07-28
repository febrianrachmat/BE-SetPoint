import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class RecalculateStandingsDto {
  @ApiPropertyOptional({
    description: 'Limit recalc to one group; omit to recalculate all Official groups',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
