import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type ScheduleReviewOutcome = 'approved' | 'rejected';

export class ReviewScheduleVersionDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsIn(['approved', 'rejected'])
  outcome!: ScheduleReviewOutcome;

  @ApiPropertyOptional({ example: 'Court load looks balanced' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
