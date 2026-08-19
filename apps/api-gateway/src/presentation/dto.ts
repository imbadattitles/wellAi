import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTopicProgramDto {
  @Transform(trimString)
  @IsString()
  @Length(3, 200)
  topic!: string;

  @Transform(trimString)
  @IsString()
  @Length(3, 500)
  goal!: string;

  @IsIn(['beginner', 'intermediate', 'advanced'])
  level!: 'beginner' | 'intermediate' | 'advanced';

  @Transform(trimString)
  @IsString()
  @Length(2, 16)
  language!: string;
}

export class CreateDocumentProgramDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  title!: string;

  @Transform(trimString)
  @IsString()
  @Length(2, 16)
  language!: string;
}

export class AskQuestionDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 2000)
  question!: string;

  @Transform(trimString)
  @IsString()
  @Length(2, 16)
  language!: string;
}

export class GenerateQuizDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count = 5;

  @IsIn(['easy', 'medium', 'hard'])
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  @Transform(trimString)
  @IsString()
  @Length(2, 16)
  language!: string;
}

export class SubmitLearningAnswerDto {
  @IsString()
  @Length(1, 10_000)
  @Transform(trimString)
  answer!: string;

  @Transform(trimString)
  @IsString()
  @Length(2, 16)
  language!: string;
}

export class CreateInterviewDto {
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
  @Length(1, 50, { each: true })
  technologies!: string[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20_000)
  vacancyText?: string;

  @Transform(trimString)
  @IsString()
  @Length(2, 16)
  language!: string;
}

export class SubmitInterviewAnswerDto {
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
