import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ScoreSideDto {
  @ApiProperty({ enum: ['A', 'B'], example: 'A' })
  @IsIn(['A', 'B'])
  side!: 'A' | 'B';
}

export class ScoreDeltaDto {
  @ApiProperty({ enum: ['A', 'B'], example: 'A' })
  @IsIn(['A', 'B'])
  side!: 'A' | 'B';

  @ApiProperty({ enum: [1, -1], example: 1 })
  @IsIn([1, -1])
  delta!: 1 | -1;
}
