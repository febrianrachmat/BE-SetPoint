import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourtStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DisableCourtDto {
  @ApiPropertyOptional({
    enum: [CourtStatus.unavailable, CourtStatus.maintenance],
    default: CourtStatus.unavailable,
  })
  @IsOptional()
  @IsIn([CourtStatus.unavailable, CourtStatus.maintenance])
  status?: 'unavailable' | 'maintenance';

  @ApiPropertyOptional({ example: 'Flooded after rain' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
