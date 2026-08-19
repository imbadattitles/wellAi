import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RetrieveKnowledgeDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2_000)
  @Matches(/\S/, { message: 'query must contain non-whitespace text' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  query!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit!: number;
}
