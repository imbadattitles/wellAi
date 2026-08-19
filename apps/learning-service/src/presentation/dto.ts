import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, Length, Max, Matches, Min } from 'class-validator';

export class CreateTopicProgramDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(3, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  topic!: string;

  @IsString()
  @Length(3, 500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  goal!: string;

  @IsIn(['beginner', 'intermediate', 'advanced'])
  level!: 'beginner' | 'intermediate' | 'advanced';

  @IsString()
  @Length(2, 16)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  language!: string;
}

export class CreateDocumentProgramDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsString()
  @Length(1, 255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fileName!: string;

  @IsString()
  @Length(2, 16)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  language!: string;
}

export class AskQuestionDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(2, 2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  question!: string;

  @IsString()
  @Length(2, 16)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  language!: string;
}

export class GenerateQuizDto {
  @IsUUID()
  userId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count = 5;

  @IsIn(['easy', 'medium', 'hard'])
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  @IsString()
  @Length(2, 16)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  language!: string;
}

export class SubmitAnswerDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(1, 10_000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  answer!: string;

  @IsString()
  @Length(2, 16)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  language!: string;
}

export class OwnedProgramQueryDto {
  @IsUUID()
  userId!: string;
}

export class MarkDocumentUploadFailedDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  sourceId!: string;

  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Za-z0-9_.:-]+$/)
  errorCode!: string;
}
