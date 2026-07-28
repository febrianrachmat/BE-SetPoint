import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: "Men's Open" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'doubles_group_playoff' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  format!: string;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.private })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({
    example: {
      teamSize: 2,
      groupCount: 2,
      teamsPerGroup: 4,
      scoring: { templateId: 'one_set_6_gp_tb5' },
    },
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
