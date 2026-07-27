import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({ example: 'Player 01' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;
}
