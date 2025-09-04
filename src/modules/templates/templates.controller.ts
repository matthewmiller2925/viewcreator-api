import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CustomLoggerService } from '../../common/logger';
import { FalAiService } from '../fal-ai/fal-ai.service';
import { GenerateImageDto, FalImageModel } from '../fal-ai/dto/fal-ai-base.dto';

class CreateTemplateDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  images?: unknown;
}

class GenerateFromTemplateDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  count?: number;

  @IsOptional()
  @IsString()
  aspectRatio?: string;
}

@Controller('templates')
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly logger: CustomLoggerService,
    private readonly falAiService: FalAiService,
  ) {
    this.logger.setContext('TemplatesController');
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: CreateTemplateDto) {
    this.logger.debug('Create template attempt', { body: this.logger.redact(body) });
    const result = await this.templatesService.createTemplate(body);
    this.logger.log('Template created', { templateId: result.id, promptPreview: (result.prompt || '').slice(0, 60) });
    return result;
  }

  @Get()
  async list() {
    this.logger.debug('List templates request');
    const result = await this.templatesService.listTemplates();
    this.logger.log('Templates listed', { count: result.length });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('uploads/presign')
  async createUploadUrls(
    @Body() body: { files: { key: string; contentType: string }[] }
  ) {
    this.logger.debug('Create presigned URLs request', { count: body?.files?.length || 0 });
    const result = await this.templatesService.createPresignedUploadUrls(body);
    this.logger.log('Presigned URLs created', { count: result.urls.length });
    return result;
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const tpl = await this.templatesService.getTemplateById(id);
    return tpl;
  }

  @Post(':id/generate')
  async generateFromTemplate(@Param('id') id: string, @Body() body?: GenerateFromTemplateDto) {
    const tpl = await this.templatesService.getTemplateById(id);
    if (!tpl) return { success: false, error: 'Template not found' };
    
    const refs: string[] = this.extractImageUrls(tpl.images);
    const count = Math.max(1, Math.min(6, Number(body?.count) || 1));
    const aspectRatio = body?.aspectRatio || '1:1';
    
    this.logger.debug('Generate from template', { 
      templateId: id, 
      count, 
      aspectRatio,
      refCount: refs.length 
    });
    
    try {
      // Enhanced prompt with reference images context
      let enhancedPrompt = this.constructEnhancedPrompt(tpl.prompt, refs.length > 0, aspectRatio);

      if (count === 1) {
        // Single image generation
        const dto: GenerateImageDto = {
          prompt: enhancedPrompt,
          num_images: 1,
          aspect_ratio: aspectRatio,
          model: FalImageModel.NANO_BANANA,
          // Use first reference image if available
          image_url: refs.length > 0 ? refs[0] : undefined,
          strength: refs.length > 0 ? 0.7 : undefined, // Moderate influence from reference
        };

        const result = await this.falAiService.generateImage(dto);
        return {
          success: true,
          imageUrl: result.images[0]?.url,
          images: result.images.map(img => img.url),
          message: 'Image generated successfully from template',
        };
      } else {
        // Multiple image generation
        const promises = Array.from({ length: count }, async (_, i) => {
          const dto: GenerateImageDto = {
            prompt: `${enhancedPrompt}\n\nVariation ${i + 1}: Create a unique interpretation while maintaining consistent style and theme.`,
            num_images: 1,
            aspect_ratio: aspectRatio,
            model: FalImageModel.NANO_BANANA,
            image_url: refs.length > i ? refs[i] : refs[0], // Cycle through references
            strength: refs.length > 0 ? 0.7 : undefined,
          };

          const result = await this.falAiService.generateImage(dto);
          return result.images[0]?.url;
        });

        const imageUrls = await Promise.all(promises);
        return {
          success: true,
          images: imageUrls.filter(Boolean),
          message: `${count} images generated successfully from template`,
        };
      }
    } catch (error) {
      this.logger.error('Template generation failed', error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }

  private extractImageUrls(images: unknown, maxDepth = 3): string[] {
    const urls: string[] = [];
    const visit = (val: any, depth: number) => {
      if (depth < 0 || val == null) return;
      if (typeof val === 'string') {
        if (val.startsWith('http') || val.startsWith('https') || val.startsWith('data:')) urls.push(val);
        return;
      }
      if (Array.isArray(val)) {
        for (const v of val) visit(v, depth - 1);
        return;
      }
      if (typeof val === 'object') {
        if (typeof val.url === 'string') {
          urls.push(val.url);
        }
        for (const key of Object.keys(val)) {
          if (key === 'url') continue;
          visit(val[key], depth - 1);
        }
      }
    };
    visit(images as any, maxDepth);
    // Deduplicate
    return Array.from(new Set(urls.filter(Boolean)));
  }

  /**
   * Constructs an enhanced prompt with best practices for AI image generation
   */
  private constructEnhancedPrompt(originalPrompt: string, hasReferenceImages: boolean, aspectRatio: string): string {
    const aspectRatioDescriptions: Record<string, string> = {
      '1:1': 'square format, perfect for social media posts',
      '4:5': 'portrait format, ideal for Instagram posts',
      '16:9': 'landscape format, great for banners and headers',
      '9:16': 'vertical format, perfect for stories and mobile content',
      '3:4': 'portrait format, suitable for print and posters',
      '4:3': 'landscape format, classic photography composition'
    };

    const aspectDescription = aspectRatioDescriptions[aspectRatio] || 'specified aspect ratio';

    let enhancedPrompt = '';

    if (hasReferenceImages) {
      enhancedPrompt = `You are a professional AI image generator specializing in creating high-quality visual content for social media and marketing purposes.

CORE OBJECTIVE: Create a stunning image that combines the creative vision from the text prompt with the visual style elements from the provided reference images.

PRIMARY PROMPT: "${originalPrompt}"

REFERENCE IMAGE INSTRUCTIONS:
- Carefully analyze the provided reference image(s) for: lighting style, color palette, composition techniques, artistic style, mood and atmosphere, visual elements and patterns
- Extract and apply the STYLE elements while keeping the CONTENT true to the primary prompt
- Maintain visual consistency with the reference aesthetic while expressing the new concept
- Use the reference as inspiration for technique, not as content to copy

COMPOSITION REQUIREMENTS:
- Format: Create in ${aspectDescription}
- Quality: Professional, high-resolution output suitable for social media
- Focus: Ensure the main subject is clearly visible and compelling
- Balance: Apply rule of thirds and proper visual hierarchy

STYLE DIRECTIVES:
- Lighting: Match the lighting mood and direction from reference images
- Colors: Harmonize with the color scheme observed in reference images
- Texture: Incorporate similar texture qualities and visual treatment
- Depth: Maintain similar depth of field and spatial relationships

OUTPUT QUALITY:
- Crisp, professional-grade image quality
- Vibrant but natural colors
- Sharp details with proper contrast
- Social media optimized composition

FINAL INSTRUCTION: Generate an image that a viewer would recognize as stylistically related to the reference image(s) while clearly depicting the concept from the primary prompt.`;
    } else {
      enhancedPrompt = `You are a professional AI image generator specializing in creating high-quality visual content for social media and marketing purposes.

PRIMARY PROMPT: "${originalPrompt}"

COMPOSITION REQUIREMENTS:
- Format: Create in ${aspectDescription}
- Quality: Professional, high-resolution output suitable for social media
- Focus: Ensure the main subject is clearly visible and compelling
- Balance: Apply rule of thirds and proper visual hierarchy

STYLE DIRECTIVES:
- Lighting: Use professional, well-balanced lighting that enhances the subject
- Colors: Vibrant but natural color palette that's visually appealing
- Composition: Strong visual composition with clear focal points
- Depth: Appropriate depth of field for the subject matter

OUTPUT QUALITY:
- Crisp, professional-grade image quality
- Vibrant but natural colors
- Sharp details with proper contrast
- Social media optimized composition

FINAL INSTRUCTION: Create a visually striking image that effectively communicates the concept while being optimized for social media engagement.`;
    }

    return enhancedPrompt;
  }
}