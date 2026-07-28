import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ScorePointDto {
  @ApiProperty({ enum: ['A', 'B'], example: 'A' })
  @IsIn(['A', 'B'])
  side!: 'A' | 'B';
}
