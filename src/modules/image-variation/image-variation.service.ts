import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { GenerateVariationDto, GenerateVariationResponseDto, VariationType } from './dto/generate-variation.dto';
import { CustomLoggerService } from '../../common/logger';

interface GeminiPart {
  inlineData?: {
    data: string;
  };
  inline_data?: {
    data: string;
  };
}

@Injectable()
export class ImageVariationService {
  private readonly variationPrompts = {
    [VariationType.COLOR_SHIFT]: 'with a completely different color palette and mood',
    [VariationType.STYLE_CHANGE]: 'in a dramatically different artistic style and technique',
    [VariationType.LIGHTING]: 'with completely different lighting conditions and atmosphere',
    [VariationType.COMPOSITION]: 'with a different composition, perspective, and framing',
    [VariationType.MOOD]: 'with a completely different emotional tone and ambiance',
    [VariationType.DETAILED]: 'with much more intricate details and complexity',
    [VariationType.SIMPLIFIED]: 'with a more minimalist and simplified approach',
    [VariationType.ABSTRACT]: 'with abstract and artistic interpretation',
  };

  private readonly stylePrompts = {
    'photorealistic': 'Ultra-realistic, high-resolution photography with perfect lighting, sharp details, professional DSLR quality, 8K resolution, cinematic depth of field',
    'professional-photo': 'Studio-quality professional photography with perfect lighting, clean composition, commercial-grade imagery, crisp details, professional color grading',
    'graphic-design': 'Clean, modern graphic design with bold typography, geometric shapes, contemporary color palette, minimalist aesthetic, vector-style elements',
    'digital-art': 'Contemporary digital artwork with vibrant colors, artistic composition, creative effects, digital painting techniques, modern artistic style',
    'illustration': 'Hand-drawn illustration style with artistic flair, creative interpretation, artistic linework, stylized composition, illustrative techniques',
    'minimalist': 'Clean, simple design with minimal elements, lots of white space, elegant simplicity, refined aesthetic, uncluttered composition',
    'cinematic': 'Movie-grade cinematic quality with dramatic lighting, film-like color grading, professional cinematography, epic composition, theatrical atmosphere',
    'vintage': 'Retro aesthetic with nostalgic feel, classic color tones, vintage photography style, aged appearance, timeless quality',
    'futuristic': 'Modern sci-fi inspired design with sleek elements, advanced technology aesthetic, metallic surfaces, neon accents, cutting-edge style',
    'abstract': 'Creative abstract composition with experimental forms, artistic interpretation, non-representational elements, creative visual expression'
  };

  private readonly aspectRatioPrompts = {
    '1:1': 'perfectly centered composition, balanced square format, Instagram-optimized',
    '16:9': 'wide cinematic composition, landscape orientation, YouTube thumbnail optimized',
    '9:16': 'vertical composition, portrait orientation, Instagram story optimized, mobile-first design',
    '4:3': 'classic photo composition, traditional aspect ratio, well-balanced framing',
    '3:4': 'portrait orientation, vertical composition, social media optimized'
  };

  constructor(
    private configService: ConfigService,
    private logger: CustomLoggerService,
  ) {
    this.logger.setContext('ImageVariationService');
  }

  async generateVariation(generateVariationDto: GenerateVariationDto): Promise<GenerateVariationResponseDto> {
    const startTime = Date.now();
    const { originalPrompt, aspectRatio, style, variationType } = generateVariationDto;

    this.logger.log(`Starting image variation generation`, {
      originalPrompt: originalPrompt.substring(0, 100) + (originalPrompt.length > 100 ? '...' : ''),
      aspectRatio,
      style,
      variationType,
    });

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('Missing GEMINI_API_KEY environment variable');
      throw new InternalServerErrorException('Missing GEMINI_API_KEY environment variable');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const styleEnhancement = this.stylePrompts[style] || this.stylePrompts.photorealistic;
      const aspectRatioEnhancement = this.aspectRatioPrompts[aspectRatio] || this.aspectRatioPrompts['1:1'];
      const variationEnhancement = this.variationPrompts[variationType as VariationType] || 'with creative variations and changes';
      
      const enhancedPrompt = `Create a new variation of this image concept with the following specifications:

ORIGINAL CONCEPT: ${originalPrompt}

VARIATION TYPE: ${variationEnhancement}

STYLE: ${styleEnhancement}
COMPOSITION: ${aspectRatioEnhancement}

Additional requirements:
- Create a distinctly different version while maintaining the core concept
- High quality and visually striking
- Perfect for social media sharing
- Professional-grade result
- Optimized colors and contrast
- Sharp, clear details throughout
- Make it feel fresh and unique compared to the original

Generate this variation with exceptional creativity and attention to detail.`;

      this.logger.debug('Calling Gemini API for variation', {
        model: 'gemini-2.5-flash-image-preview',
        promptLength: enhancedPrompt.length,
        variationType,
      });

      const apiStartTime = Date.now();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: enhancedPrompt,
      });
      const apiDuration = Date.now() - apiStartTime;

      this.logger.logApiCall('Gemini', 'generateContent-variation', apiDuration, true);

      const candidates = response?.candidates ?? [];
      let base64: string | undefined;
      
      for (const cand of candidates) {
        const parts = cand?.content?.parts ?? [];
        for (const part of parts) {
          const data = part?.inlineData?.data || (part as GeminiPart)?.inline_data?.data;
          if (data) {
            base64 = data as string;
            break;
          }
        }
        if (base64) break;
      }

      if (!base64) {
        const duration = Date.now() - startTime;
        this.logger.logImageVariation(originalPrompt, variationType, duration, false, 'No image data returned from Gemini');
        throw new BadRequestException('Gemini did not return image data. Try generating the variation again.');
      }

      const imageUrl = `data:image/png;base64,${base64}`;
      const totalDuration = Date.now() - startTime;

      this.logger.logImageVariation(originalPrompt, variationType, totalDuration, true);

      // Log performance metrics
      if (totalDuration > 10000) {
        this.logger.logPerformance('image-variation-slow', totalDuration, {
          originalPrompt: originalPrompt.substring(0, 50) + '...',
          variationType,
          style,
          aspectRatio,
        });
      }

      return {
        success: true,
        imageUrl,
        message: `${variationType} variation generated successfully`,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      this.logger.logImageVariation(originalPrompt, variationType, duration, false, message);
      this.logger.error('Image variation generation failed', error instanceof Error ? error.stack : String(error));

      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(message);
    }
  }
}
