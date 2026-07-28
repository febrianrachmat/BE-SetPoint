import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourtStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListCourtsQueryDto {
  @ApiPropertyOptional({ enum: CourtStatus })
  @IsOptional()
  @IsEnum(CourtStatus)
  status?: CourtStatus;
}
