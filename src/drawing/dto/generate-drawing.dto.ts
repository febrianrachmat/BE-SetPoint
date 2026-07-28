import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlacementMode } from '../engine/drawing-engine.constants';

export class GenerateDrawingDto {
  @ApiProperty({ enum: PlacementMode, example: PlacementMode.random })
  @IsEnum(PlacementMode)
  placementMode!: PlacementMode;

  @ApiPropertyOptional({
    example: 'optional-explicit-seed',
    description: 'If omitted, a cryptographically strong seed is generated',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  drawingSeed?: string;
}
