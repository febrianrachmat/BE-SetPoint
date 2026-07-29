import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class AssignRefereeDto {
  @ApiProperty({ example: 'referee@setpoint.local' })
  @IsEmail()
  email!: string;
}
