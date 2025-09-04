import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fal from '@fal-ai/serverless-client';
import {
  GenerateImageDto,
  GenerateVideoDto,
  ChatCompletionDto,
  SpeechToTextDto,
  ImageEditingDto,
  CustomWorkflowDto,
  FalImageModel,
  FalVideoModel,
  FalLLMModel,
} from './dto/fal-ai-base.dto';

export interface FalImageResult {
  images: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  seed: number;
  has_nsfw_concepts: boolean[];
}

export interface FalVideoResult {
  video: {
    url: string;
  };
  seed: number;
}

export interface FalChatResult {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface FalSpeechResult {
  text: string;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

@Injectable()
export class FalAiService {
  private readonly logger = new Logger(FalAiService.name);
  
  private falKey: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.falKey = this.configService.get<string>('FAL_API_KEY') || null;
    if (!this.falKey) {
      this.logger.warn('FAL_API_KEY is not configured - Fal AI functionality will be disabled');
    } else {
      try {
        fal.config({
          credentials: this.falKey,
        });
        this.logger.log('Fal AI service initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Fal AI service', error);
        this.falKey = null;
      }
    }
  }

  private checkApiKey() {
    if (!this.falKey) {
      throw new InternalServerErrorException('Fal AI service is not properly configured. Please set FAL_API_KEY environment variable.');
    }
  }

  /**
   * Generate images using various Fal AI models
   */
  async generateImage(dto: GenerateImageDto): Promise<FalImageResult> {
    this.checkApiKey();
    const startTime = Date.now();
    const model = dto.model || FalImageModel.NANO_BANANA;

    try {
      this.logger.log(`Generating image with model: ${model}`, {
        prompt: dto.prompt.substring(0, 100) + '...',
        model,
      });

      const input: any = {
        prompt: dto.prompt,
      };

      // Add optional parameters based on model capabilities
      if (dto.negative_prompt) input.negative_prompt = dto.negative_prompt;
      if (dto.num_images) input.num_images = Math.min(dto.num_images, 4);
      if (dto.aspect_ratio) input.aspect_ratio = dto.aspect_ratio;
      if (dto.guidance_scale) input.guidance_scale = dto.guidance_scale;
      if (dto.num_inference_steps) input.num_inference_steps = dto.num_inference_steps;
      if (dto.seed) input.seed = parseInt(dto.seed);

      // Handle image-to-image generation
      if (dto.image_url) {
        input.image_url = dto.image_url;
        if (dto.strength) input.strength = dto.strength;
      }

      const result = await fal.subscribe(model, {
        input,
        logs: true,
      }) as FalImageResult;

      const duration = Date.now() - startTime;
      this.logger.log(`Image generation completed`, {
        model,
        duration: `${duration}ms`,
        imageCount: result.images?.length || 0,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Image generation failed`, {
        model,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (error instanceof Error && error.message.includes('content policy')) {
        throw new BadRequestException('Content violates safety policies. Please modify your prompt.');
      }
      
      throw new InternalServerErrorException(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate videos from text or images
   */
  async generateVideo(dto: GenerateVideoDto): Promise<FalVideoResult> {
    const startTime = Date.now();
    const model = dto.model || FalVideoModel.STABLE_VIDEO;

    try {
      this.logger.log(`Generating video with model: ${model}`, {
        prompt: dto.prompt.substring(0, 100) + '...',
        model,
        hasImage: !!dto.image_url,
      });

      const input: any = {
        prompt: dto.prompt,
      };

      if (dto.image_url) input.image_url = dto.image_url;
      if (dto.duration) input.duration = dto.duration;
      if (dto.aspect_ratio) input.aspect_ratio = dto.aspect_ratio;
      if (dto.motion_bucket_id) input.motion_bucket_id = dto.motion_bucket_id;

      const result = await fal.subscribe(model, {
        input,
        logs: true,
      }) as FalVideoResult;

      const duration = Date.now() - startTime;
      this.logger.log(`Video generation completed`, {
        model,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Video generation failed`, {
        model,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new InternalServerErrorException(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Chat completion using Fal AI LLMs
   */
  async chatCompletion(dto: ChatCompletionDto): Promise<FalChatResult> {
    const startTime = Date.now();
    const model = dto.model || FalLLMModel.LLAMA_8B;

    try {
      this.logger.log(`Processing chat completion`, {
        model,
        messageCount: dto.messages.length,
        maxTokens: dto.max_tokens,
      });

      const input: any = {
        messages: dto.messages,
      };

      if (dto.max_tokens) input.max_tokens = dto.max_tokens;
      if (dto.temperature !== undefined) input.temperature = dto.temperature;
      if (dto.top_p !== undefined) input.top_p = dto.top_p;
      if (dto.stream !== undefined) input.stream = dto.stream;

      const result = await fal.subscribe(model, {
        input,
      }) as FalChatResult;

      const duration = Date.now() - startTime;
      this.logger.log(`Chat completion completed`, {
        model,
        duration: `${duration}ms`,
        tokensUsed: result.usage?.total_tokens,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Chat completion failed`, {
        model,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new InternalServerErrorException(`Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert speech to text using Whisper
   */
  async speechToText(dto: SpeechToTextDto): Promise<FalSpeechResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Converting speech to text`, {
        audioUrl: dto.audio_url,
        language: dto.language,
        translate: dto.translate,
      });

      const input: any = {
        audio_url: dto.audio_url,
      };

      if (dto.language) input.language = dto.language;
      if (dto.translate !== undefined) input.translate = dto.translate;

      const result = await fal.subscribe('fal-ai/whisper', {
        input,
      }) as FalSpeechResult;

      const duration = Date.now() - startTime;
      this.logger.log(`Speech to text completed`, {
        duration: `${duration}ms`,
        textLength: result.text?.length || 0,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Speech to text failed`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new InternalServerErrorException(`Speech to text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Edit images with AI
   */
  async editImage(dto: ImageEditingDto): Promise<FalImageResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Editing image`, {
        imageUrl: dto.image_url,
        prompt: dto.prompt.substring(0, 100) + '...',
        hasMask: !!dto.mask_url,
      });

      const input: any = {
        image_url: dto.image_url,
        prompt: dto.prompt,
      };

      if (dto.mask_url) input.mask_url = dto.mask_url;
      if (dto.strength !== undefined) input.strength = dto.strength;
      if (dto.guidance_scale !== undefined) input.guidance_scale = dto.guidance_scale;

      // Use appropriate editing model based on whether we have a mask
      const model = dto.mask_url ? 'fal-ai/stable-diffusion-v3-inpainting' : 'fal-ai/stable-diffusion-v3-image-to-image';

      const result = await fal.subscribe(model, {
        input,
      }) as FalImageResult;

      const duration = Date.now() - startTime;
      this.logger.log(`Image editing completed`, {
        duration: `${duration}ms`,
        imageCount: result.images?.length || 0,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Image editing failed`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new InternalServerErrorException(`Image editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute custom workflow
   */
  async executeWorkflow(dto: CustomWorkflowDto): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Executing custom workflow`, {
        workflowId: dto.workflow_id,
        hasInput: !!dto.input,
      });

      const result = await fal.subscribe(dto.workflow_id, {
        input: dto.input || {},
        logs: true,
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Workflow execution completed`, {
        workflowId: dto.workflow_id,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Workflow execution failed`, {
        workflowId: dto.workflow_id,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new InternalServerErrorException(`Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate image variations
   */
  async generateImageVariations(imageUrl: string, prompt?: string, count: number = 1): Promise<FalImageResult> {
    return this.generateImage({
      prompt: prompt || 'Create variations of this image maintaining the same style and composition',
      image_url: imageUrl,
      num_images: Math.min(count, 4),
      strength: 0.7, // Moderate variation
    });
  }

  /**
   * Remove background from image
   */
  async removeBackground(imageUrl: string): Promise<{ image: { url: string } }> {
    const startTime = Date.now();

    try {
      this.logger.log(`Removing background from image`, { imageUrl });

      const result = await fal.subscribe('fal-ai/birefnet', {
        input: {
          image_url: imageUrl,
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Background removal completed`, {
        duration: `${duration}ms`,
      });

      return result as { image: { url: string } };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Background removal failed`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new InternalServerErrorException(`Background removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upscale image
   */
  async upscaleImage(imageUrl: string, scale: number = 2): Promise<{ image: { url: string } }> {
    const startTime = Date.now();

    try {
      this.logger.log(`Upscaling image`, { imageUrl, scale });

      const result = await fal.subscribe('fal-ai/clarity-upscaler', {
        input: {
          image_url: imageUrl,
          scale_factor: Math.min(Math.max(scale, 1), 4), // Clamp between 1-4
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Image upscaling completed`, {
        duration: `${duration}ms`,
      });

      return result as { image: { url: string } };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Image upscaling failed`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new InternalServerErrorException(`Image upscaling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
