import { IsOptional, IsString, IsNumber, IsArray, IsBoolean, IsEnum } from 'class-validator';

export class BaseGenerationDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  negative_prompt?: string;

  @IsOptional()
  @IsNumber()
  num_images?: number;

  @IsOptional()
  @IsString()
  aspect_ratio?: string;

  @IsOptional()
  @IsNumber()
  guidance_scale?: number;

  @IsOptional()
  @IsNumber()
  num_inference_steps?: number;

  @IsOptional()
  @IsString()
  seed?: string;
}

export enum FalImageModel {
  NANO_BANANA = 'fal-ai/nano-banana',
  FLUX_DEV = 'fal-ai/flux/dev',
  FLUX_SCHNELL = 'fal-ai/flux/schnell',
  FLUX_PRO = 'fal-ai/flux-pro/v1.1-ultra',
  RECRAFT_V3 = 'fal-ai/recraft-v3',
  STABLE_DIFFUSION_35 = 'fal-ai/stable-diffusion-v35-large',
  STABLE_DIFFUSION_3 = 'fal-ai/stable-diffusion-v3-medium',
}

export enum FalVideoModel {
  STABLE_VIDEO = 'fal-ai/stable-video',
  LUMA_DREAM_MACHINE = 'fal-ai/luma-dream-machine',
  RUNWAY_GEN3 = 'fal-ai/runway-gen3/turbo/image-to-video',
}

export enum FalLLMModel {
  LLAMA_8B = 'fal-ai/llama-3.2-8b-instruct',
  LLAMA_70B = 'fal-ai/llama-3.1-70b-instruct',
  QWEN_32B = 'fal-ai/qwen2.5-32b-instruct',
}

export class GenerateImageDto extends BaseGenerationDto {
  @IsOptional()
  @IsEnum(FalImageModel)
  model?: FalImageModel;

  @IsOptional()
  @IsString()
  image_url?: string; // For image-to-image

  @IsOptional()
  @IsNumber()
  strength?: number; // For image-to-image
}

export class GenerateVideoDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsEnum(FalVideoModel)
  model?: FalVideoModel;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  aspect_ratio?: string;

  @IsOptional()
  @IsNumber()
  motion_bucket_id?: number;
}

export class ChatCompletionDto {
  @IsArray()
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;

  @IsOptional()
  @IsEnum(FalLLMModel)
  model?: FalLLMModel;

  @IsOptional()
  @IsNumber()
  max_tokens?: number;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  top_p?: number;

  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}

export class SpeechToTextDto {
  @IsString()
  audio_url: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  translate?: boolean;
}

export class ImageEditingDto {
  @IsString()
  image_url: string;

  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  mask_url?: string;

  @IsOptional()
  @IsNumber()
  strength?: number;

  @IsOptional()
  @IsNumber()
  guidance_scale?: number;
}

export class CustomWorkflowDto {
  @IsString()
  workflow_id: string;

  @IsOptional()
  input?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}
