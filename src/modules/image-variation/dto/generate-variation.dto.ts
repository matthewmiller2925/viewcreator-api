import { IsString, IsNotEmpty } from 'class-validator';

export enum VariationType {
  COLOR_SHIFT = 'color-shift',
  STYLE_CHANGE = 'style-change',
  LIGHTING = 'lighting',
  COMPOSITION = 'composition',
  MOOD = 'mood',
  DETAILED = 'detailed',
  SIMPLIFIED = 'simplified',
  ABSTRACT = 'abstract',
}

export class GenerateVariationDto {
  @IsString()
  @IsNotEmpty()
  originalPrompt: string;

  @IsString()
  @IsNotEmpty()
  aspectRatio: string;

  @IsString()
  @IsNotEmpty()
  style: string;

  @IsString()
  @IsNotEmpty()
  variationType: string;
}

export class GenerateVariationResponseDto {
  success: boolean;
  imageUrl?: string;
  error?: string;
  message?: string;
}
