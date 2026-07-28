import { ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: "Men's Open" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'doubles_group_playoff' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  format?: string;

  @ApiPropertyOptional({ enum: Visibility })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({
    example: {
      competitionMode: 'knockout_only',
      teamSize: 2,
      scoring: { templateId: 'one_set_6_gp_tb5' },
    },
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown> | null;
}
