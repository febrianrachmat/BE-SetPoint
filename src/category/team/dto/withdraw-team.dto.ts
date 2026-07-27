import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class WithdrawTeamDto {
  @ApiProperty({ example: 'Injury before group stage' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
