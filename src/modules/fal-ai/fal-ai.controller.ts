import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FalAiService } from './fal-ai.service';
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('fal-ai')
export class FalAiController {
  constructor(private readonly falAiService: FalAiService) {}

  /**
   * Generate images from text prompts
   * POST /fal-ai/generate/image
   */
  @Post('generate/image')
  @HttpCode(HttpStatus.OK)
  async generateImage(@Body() dto: GenerateImageDto) {
    const result = await this.falAiService.generateImage(dto);
    return {
      success: true,
      data: result,
      message: 'Image generated successfully',
    };
  }

  /**
   * Generate videos from text or images
   * POST /fal-ai/generate/video
   */
  @Post('generate/video')
  @HttpCode(HttpStatus.OK)
  async generateVideo(@Body() dto: GenerateVideoDto) {
    const result = await this.falAiService.generateVideo(dto);
    return {
      success: true,
      data: result,
      message: 'Video generated successfully',
    };
  }

  /**
   * Generate image variations
   * POST /fal-ai/generate/variations
   */
  @Post('generate/variations')
  @HttpCode(HttpStatus.OK)
  async generateVariations(
    @Body() body: { image_url: string; prompt?: string; count?: number }
  ) {
    const result = await this.falAiService.generateImageVariations(
      body.image_url,
      body.prompt,
      body.count || 1
    );
    return {
      success: true,
      data: result,
      message: 'Image variations generated successfully',
    };
  }

  /**
   * Chat completion using LLMs
   * POST /fal-ai/chat/completion
   */
  @Post('chat/completion')
  @HttpCode(HttpStatus.OK)
  async chatCompletion(@Body() dto: ChatCompletionDto) {
    const result = await this.falAiService.chatCompletion(dto);
    return {
      success: true,
      data: result,
      message: 'Chat completion generated successfully',
    };
  }

  /**
   * Convert speech to text
   * POST /fal-ai/speech/to-text
   */
  @Post('speech/to-text')
  @HttpCode(HttpStatus.OK)
  async speechToText(@Body() dto: SpeechToTextDto) {
    const result = await this.falAiService.speechToText(dto);
    return {
      success: true,
      data: result,
      message: 'Speech converted to text successfully',
    };
  }

  /**
   * Edit images with AI
   * POST /fal-ai/edit/image
   */
  @Post('edit/image')
  @HttpCode(HttpStatus.OK)
  async editImage(@Body() dto: ImageEditingDto) {
    const result = await this.falAiService.editImage(dto);
    return {
      success: true,
      data: result,
      message: 'Image edited successfully',
    };
  }

  /**
   * Remove background from image
   * POST /fal-ai/edit/remove-background
   */
  @Post('edit/remove-background')
  @HttpCode(HttpStatus.OK)
  async removeBackground(@Body() body: { image_url: string }) {
    const result = await this.falAiService.removeBackground(body.image_url);
    return {
      success: true,
      data: result,
      message: 'Background removed successfully',
    };
  }

  /**
   * Upscale image
   * POST /fal-ai/edit/upscale
   */
  @Post('edit/upscale')
  @HttpCode(HttpStatus.OK)
  async upscaleImage(@Body() body: { image_url: string; scale?: number }) {
    const result = await this.falAiService.upscaleImage(body.image_url, body.scale);
    return {
      success: true,
      data: result,
      message: 'Image upscaled successfully',
    };
  }

  /**
   * Execute custom workflow
   * POST /fal-ai/workflow/execute
   */
  @Post('workflow/execute')
  @HttpCode(HttpStatus.OK)
  async executeWorkflow(@Body() dto: CustomWorkflowDto) {
    const result = await this.falAiService.executeWorkflow(dto);
    return {
      success: true,
      data: result,
      message: 'Workflow executed successfully',
    };
  }

  /**
   * Get available image models
   * GET /fal-ai/models/image
   */
  @Get('models/image')
  getImageModels() {
    return {
      success: true,
      data: {
        models: Object.values(FalImageModel).map(model => ({
          id: model,
          name: model.split('/').pop()?.replace('-', ' ').toUpperCase(),
          description: this.getModelDescription(model),
        })),
      },
      message: 'Image models retrieved successfully',
    };
  }

  /**
   * Get available video models
   * GET /fal-ai/models/video
   */
  @Get('models/video')
  getVideoModels() {
    return {
      success: true,
      data: {
        models: Object.values(FalVideoModel).map(model => ({
          id: model,
          name: model.split('/').pop()?.replace('-', ' ').toUpperCase(),
          description: this.getModelDescription(model),
        })),
      },
      message: 'Video models retrieved successfully',
    };
  }

  /**
   * Get available LLM models
   * GET /fal-ai/models/llm
   */
  @Get('models/llm')
  getLLMModels() {
    return {
      success: true,
      data: {
        models: Object.values(FalLLMModel).map(model => ({
          id: model,
          name: model.split('/').pop()?.replace('-', ' ').toUpperCase(),
          description: this.getModelDescription(model),
        })),
      },
      message: 'LLM models retrieved successfully',
    };
  }

  /**
   * Get model capabilities and parameters
   * GET /fal-ai/models/:modelId/info
   */
  @Get('models/:modelId/info')
  getModelInfo(@Param('modelId') modelId: string) {
    const modelCapabilities = this.getModelCapabilities(modelId);
    return {
      success: true,
      data: {
        modelId,
        capabilities: modelCapabilities,
        parameters: this.getModelParameters(modelId),
      },
      message: 'Model information retrieved successfully',
    };
  }

  /**
   * Health check for Fal AI service
   * GET /fal-ai/health
   */
  @Get('health')
  healthCheck() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Fal AI Integration',
        configuredProperly: !!this.falAiService['falKey'],
      },
      message: 'Service is healthy',
    };
  }

  /**
   * Test endpoint to verify module loading
   * GET /fal-ai/test
   */
  @Get('test')
  testEndpoint() {
    return {
      success: true,
      data: {
        message: 'Fal AI module is loaded and working',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private getModelDescription(model: string): string {
    const descriptions: Record<string, string> = {
      [FalImageModel.NANO_BANANA]: 'High-performance model optimized for creative and artistic image generation',
      [FalImageModel.FLUX_DEV]: 'High-quality image generation with excellent prompt adherence',
      [FalImageModel.FLUX_SCHNELL]: 'Fast image generation with good quality (1-4 steps)',
      [FalImageModel.FLUX_PRO]: 'Professional-grade image generation with up to 2K resolution',
      [FalImageModel.RECRAFT_V3]: 'SOTA model for vector art, brand style, and long text generation',
      [FalImageModel.STABLE_DIFFUSION_35]: 'Improved performance in quality, typography, and understanding',
      [FalImageModel.STABLE_DIFFUSION_3]: 'Balanced performance and speed for general use',
      [FalVideoModel.STABLE_VIDEO]: 'Generate videos from images or text prompts',
      [FalVideoModel.LUMA_DREAM_MACHINE]: 'High-quality text and image to video generation',
      [FalVideoModel.RUNWAY_GEN3]: 'Fast image-to-video generation with turbo processing',
      [FalLLMModel.LLAMA_8B]: 'Fast and efficient language model for general tasks',
      [FalLLMModel.LLAMA_70B]: 'More capable language model for complex reasoning',
      [FalLLMModel.QWEN_32B]: 'High-quality multilingual language model',
    };
    return descriptions[model] || 'Advanced AI model for various tasks';
  }

  private getModelCapabilities(modelId: string): string[] {
    const imageModels = Object.values(FalImageModel);
    const videoModels = Object.values(FalVideoModel);
    const llmModels = Object.values(FalLLMModel);

    if (imageModels.includes(modelId as FalImageModel)) {
      return ['text-to-image', 'image-to-image', 'style-transfer', 'prompt-adherence'];
    }
    if (videoModels.includes(modelId as FalVideoModel)) {
      return ['text-to-video', 'image-to-video', 'motion-control', 'aspect-ratio-control'];
    }
    if (llmModels.includes(modelId as FalLLMModel)) {
      return ['text-generation', 'chat-completion', 'reasoning', 'code-generation'];
    }
    return ['general-purpose'];
  }

  private getModelParameters(modelId: string): Record<string, any> {
    const imageModels = Object.values(FalImageModel);
    const videoModels = Object.values(FalVideoModel);
    const llmModels = Object.values(FalLLMModel);

    if (imageModels.includes(modelId as FalImageModel)) {
      return {
        max_images: 4,
        supported_aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        guidance_scale_range: [1, 20],
        steps_range: [1, 50],
      };
    }
    if (videoModels.includes(modelId as FalVideoModel)) {
      return {
        max_duration: 10,
        supported_aspect_ratios: ['16:9', '9:16', '1:1'],
        motion_bucket_range: [1, 255],
      };
    }
    if (llmModels.includes(modelId as FalLLMModel)) {
      return {
        max_tokens: 4096,
        temperature_range: [0, 2],
        top_p_range: [0, 1],
        supports_streaming: true,
      };
    }
    return {};
  }
}
