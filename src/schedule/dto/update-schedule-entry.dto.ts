import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class UpdateScheduleEntryDto {
  @ApiProperty({
    description: 'New scheduled start datetime (ISO)',
    example: '2026-07-31T09:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  scheduledStartAt!: Date;

  @ApiPropertyOptional({
    description:
      'Optional scheduled end. Defaults to preserving the previous slot duration.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledEndAt?: Date;
}
