import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UnlockScheduleDto {
  @ApiProperty({
    example: 'Fix overlapping court slot before go-live',
    description: 'Mandatory unlock reason (LOCK-07)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
