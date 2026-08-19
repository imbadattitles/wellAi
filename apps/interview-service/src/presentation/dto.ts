import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateInterviewDto {
  @IsUUID()
  userId!: string;

  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  profession!: string;

  @IsIn(['junior', 'middle', 'senior', 'lead'])
  level!: 'junior' | 'middle' | 'senior' | 'lead';

  @IsIn(['technical', 'behavioral', 'mixed'])
  format!: 'technical' | 'behavioral' | 'mixed';

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  technologies!: string[];

  @Transform(trimString)
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(20_000)
  vacancyText!: string | null;

  @Transform(trimString)
  @IsString()
  @Length(2, 16)
  language!: string;
}

export class GetInterviewQueryDto {
  @IsUUID()
  userId!: string;
}

export class SubmitInterviewAnswerDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  answerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedQuestionIndex!: number;

  @Transform(trimString)
  @IsString()
  @Length(1, 10_000)
  answer!: string;
}
