import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type DrawingReviewOutcome = 'approved' | 'rejected';

export class ReviewDrawingVersionDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsIn(['approved', 'rejected'])
  outcome!: DrawingReviewOutcome;

  @ApiPropertyOptional({ example: 'Groups look balanced' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
