import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type PlayoffReviewOutcome = 'approved' | 'rejected';

export class ReviewBracketDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsIn(['approved', 'rejected'])
  outcome!: PlayoffReviewOutcome;

  @ApiPropertyOptional({ example: 'Cross-group pairing looks correct' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
