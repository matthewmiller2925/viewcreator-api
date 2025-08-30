import { IsString, IsNotEmpty, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TextOverlayDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  fontSize: number;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsString()
  @IsNotEmpty()
  fontFamily: string;

  @IsString()
  @IsNotEmpty()
  fontWeight: string;

  @IsNumber()
  rotation: number;

  @IsNumber()
  opacity: number;
}

export class EditImageDto {
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TextOverlayDto)
  textOverlays: TextOverlayDto[];
}

export class EditImageResponseDto {
  success: boolean;
  editedImageUrl?: string;
  error?: string;
  message?: string;
}
