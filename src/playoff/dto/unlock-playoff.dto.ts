import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UnlockPlayoffDto {
  @ApiProperty({
    example: 'Fix wrong seed before knockout',
    description: 'Mandatory unlock reason',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
