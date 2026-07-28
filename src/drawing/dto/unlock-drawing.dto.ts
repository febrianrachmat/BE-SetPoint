import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UnlockDrawingDto {
  @ApiProperty({
    example: 'Correct group placement before schedule generation',
    description: 'Mandatory unlock reason (LOCK-07)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
