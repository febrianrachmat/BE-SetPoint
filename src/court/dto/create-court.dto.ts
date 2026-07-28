import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCourtDto {
  @ApiProperty({ example: 'Center Court' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'C1', description: 'Short label, unique per tournament' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label!: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display position; defaults to the end of the list',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'Indoor, glass back wall' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  availabilityNotes?: string;
}
