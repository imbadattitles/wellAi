import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';

export class UploadDocumentDto {
  @IsUUID()
  sourceId!: string;

  @IsUUID()
  programId!: string;

  @IsUUID()
  userId!: string;

  @IsString()
  @Length(2, 16)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  language!: string;
}
