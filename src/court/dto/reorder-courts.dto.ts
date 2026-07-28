import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ReorderCourtsItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  courtId!: string;
}

export class ReorderCourtsDto {
  @ApiProperty({
    type: [ReorderCourtsItemDto],
    description:
      'Complete list of active courts in the desired order; position defines displayOrder',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderCourtsItemDto)
  items!: ReorderCourtsItemDto[];
}
