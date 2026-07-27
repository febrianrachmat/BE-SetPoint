import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateTeamPlayerDto {
  @ApiProperty({ example: 'Player 01' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;
}

export class CreateTeamDto {
  @ApiProperty({ example: 'Team 01' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    type: [CreateTeamPlayerDto],
    description: 'Optional players registered with the team (TEAM-001)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CreateTeamPlayerDto)
  players?: CreateTeamPlayerDto[];
}
