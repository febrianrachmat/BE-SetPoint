import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GenerateScheduleDto {
  @ApiPropertyOptional({
    description:
      'Schedule start. Defaults to Tournament.startAt or now.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startAt?: Date;

  @ApiPropertyOptional({
    example: 90,
    description: 'Slot length in minutes (default 90)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(300)
  matchDurationMinutes?: number;
}
