import { IsString, IsOptional, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';

export enum ImageStyle {
  PHOTOREALISTIC = 'photorealistic',
  PROFESSIONAL_PHOTO = 'professional-photo',
  GRAPHIC_DESIGN = 'graphic-design',
  DIGITAL_ART = 'digital-art',
  ILLUSTRATION = 'illustration',
  MINIMALIST = 'minimalist',
  CINEMATIC = 'cinematic',
  VINTAGE = 'vintage',
  FUTURISTIC = 'futuristic',
  ABSTRACT = 'abstract',
}

export class GenerateImageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Prompt must be less than 1000 characters' })
  prompt: string;

  @IsOptional()
  @IsString()
  aspectRatio?: string = '1:1';

  @IsOptional()
  @IsEnum(ImageStyle)
  style?: ImageStyle = ImageStyle.PHOTOREALISTIC;
}

export class GenerateImageResponseDto {
  success: boolean;
  imageUrl?: string;
  error?: string;
  message?: string;
}
