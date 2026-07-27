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
    example: { teamSize: 2, scoring: 'best_of_3' },
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
