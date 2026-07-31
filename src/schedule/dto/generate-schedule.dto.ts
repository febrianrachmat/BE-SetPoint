import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_SCHEDULE_STRATEGY,
  SCHEDULE_STRATEGY_GROUP_BLOCK,
  SCHEDULE_STRATEGY_ROUND_WAVE,
} from '../engine/schedule-engine.constants';

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

  @ApiPropertyOptional({
    example: 5,
    description:
      'Rest buffer in minutes after each match before the same court/teams continue (default 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  restBufferMinutes?: number;

  @ApiPropertyOptional({
    enum: [SCHEDULE_STRATEGY_GROUP_BLOCK, SCHEDULE_STRATEGY_ROUND_WAVE],
    default: DEFAULT_SCHEDULE_STRATEGY,
    description:
      'group_block: one court finishes a group before taking another. round_wave: global rounds across groups.',
  })
  @IsOptional()
  @IsIn([SCHEDULE_STRATEGY_GROUP_BLOCK, SCHEDULE_STRATEGY_ROUND_WAVE])
  strategy?: typeof SCHEDULE_STRATEGY_GROUP_BLOCK | typeof SCHEDULE_STRATEGY_ROUND_WAVE;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Optional court pool for this category. Defaults to all available courts. Use to batch categories across shared venues (e.g. courts 1-4 for this category).',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  courtIds?: string[];
}
