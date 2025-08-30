import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { GenerateImageDto, GenerateImageResponseDto, ImageStyle } from './dto/generate-image.dto';
import { createCanvas, loadImage } from 'canvas';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
// Use CommonJS require due to module interop differences
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegLib = require('fluent-ffmpeg');
import ffmpegStatic from 'ffmpeg-static';
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
export class ImageGenerationService {
  private readonly stylePrompts = {
    [ImageStyle.PHOTOREALISTIC]: 'Ultra-realistic, high-resolution photography with perfect lighting, sharp details, professional DSLR quality, 8K resolution, cinematic depth of field',
    [ImageStyle.PROFESSIONAL_PHOTO]: 'Studio-quality professional photography with perfect lighting, clean composition, commercial-grade imagery, crisp details, professional color grading',
    [ImageStyle.GRAPHIC_DESIGN]: 'Clean, modern graphic design with bold typography, geometric shapes, contemporary color palette, minimalist aesthetic, vector-style elements',
    [ImageStyle.DIGITAL_ART]: 'Contemporary digital artwork with vibrant colors, artistic composition, creative effects, digital painting techniques, modern artistic style',
    [ImageStyle.ILLUSTRATION]: 'Hand-drawn illustration style with artistic flair, creative interpretation, artistic linework, stylized composition, illustrative techniques',
    [ImageStyle.MINIMALIST]: 'Clean, simple design with minimal elements, lots of white space, elegant simplicity, refined aesthetic, uncluttered composition',
    [ImageStyle.CINEMATIC]: 'Movie-grade cinematic quality with dramatic lighting, film-like color grading, professional cinematography, epic composition, theatrical atmosphere',
    [ImageStyle.VINTAGE]: 'Retro aesthetic with nostalgic feel, classic color tones, vintage photography style, aged appearance, timeless quality',
    [ImageStyle.FUTURISTIC]: 'Modern sci-fi inspired design with sleek elements, advanced technology aesthetic, metallic surfaces, neon accents, cutting-edge style',
    [ImageStyle.ABSTRACT]: 'Creative abstract composition with experimental forms, artistic interpretation, non-representational elements, creative visual expression'
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
    this.logger.setContext('ImageGenerationService');
    // Configure ffmpeg binary for video generation
    try {
      if (ffmpegStatic) {
        const bin = ffmpegStatic as unknown as string;
        // Some environments return an array-like default; ensure string
        ffmpegLib.setFfmpegPath(Array.isArray(bin) ? bin[0] : bin);
      }
    } catch {}
  }

  private getAspectRatioPrompt(aspectRatio: string): string {
    if (this.aspectRatioPrompts[aspectRatio]) {
      return this.aspectRatioPrompts[aspectRatio];
    }
    
    const [widthStr, heightStr] = aspectRatio.split(':');
    const width = parseFloat(widthStr);
    const height = parseFloat(heightStr);
    
    if (width && height && width > 0 && height > 0) {
      const ratio = width / height;
      if (ratio > 1.5) {
        return 'wide landscape composition, horizontal orientation, banner-style layout';
      } else if (ratio < 0.7) {
        return 'tall vertical composition, portrait orientation, story-style layout';
      } else {
        return 'balanced composition, well-proportioned framing, versatile format';
      }
    }
    
    return 'perfectly centered composition, balanced format';
  }

  async generateImage(generateImageDto: GenerateImageDto): Promise<GenerateImageResponseDto> {
    const startTime = Date.now();
    const { prompt, aspectRatio = '1:1', style = ImageStyle.PHOTOREALISTIC } = generateImageDto;

    this.logger.log(`Starting image generation`, {
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      aspectRatio,
      style,
    });

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('Missing GEMINI_API_KEY environment variable');
      throw new InternalServerErrorException('Missing GEMINI_API_KEY environment variable');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const styleEnhancement = this.stylePrompts[style] || this.stylePrompts[ImageStyle.PHOTOREALISTIC];
      const aspectRatioEnhancement = this.getAspectRatioPrompt(aspectRatio);
      
      const enrichedPrompt = `Create a stunning image with the following specifications:
      
STYLE: ${styleEnhancement}
COMPOSITION: ${aspectRatioEnhancement}
SUBJECT: ${prompt}

Additional requirements:
- High quality and visually appealing
- Perfect for social media sharing
- Professional-grade result
- Optimized colors and contrast
- Sharp, clear details throughout

Generate this image with exceptional quality and attention to detail.`;

      this.logger.debug('Calling Gemini API', {
        model: 'gemini-2.5-flash-image-preview',
        promptLength: enrichedPrompt.length,
      });

      const apiStartTime = Date.now();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: enrichedPrompt,
      });
      const apiDuration = Date.now() - apiStartTime;

      this.logger.logApiCall('Gemini', 'generateContent', apiDuration, true);

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
        this.logger.logImageGeneration(prompt, style, aspectRatio, duration, false, 'No image data returned from Gemini');
        throw new BadRequestException('Gemini did not return image data. Try refining your prompt.');
      }

      // Enforce requested aspect ratio by fitting into a target canvas
      const { width: targetWidth, height: targetHeight } = this.getTargetDimensions(aspectRatio);
      const fittedBase64 = await this.fitImageToCanvas(`data:image/png;base64,${base64}`, targetWidth, targetHeight);
      const imageUrl = fittedBase64;
      const totalDuration = Date.now() - startTime;

      this.logger.logImageGeneration(prompt, style, aspectRatio, totalDuration, true);
      
      // Log performance metrics
      if (totalDuration > 10000) {
        this.logger.logPerformance('image-generation-slow', totalDuration, {
          prompt: prompt.substring(0, 50) + '...',
          style,
          aspectRatio,
        });
      }

      return {
        success: true,
        imageUrl,
        message: 'Image generated with Gemini 2.5 Flash Image Preview',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';

      this.logger.logImageGeneration(prompt, style, aspectRatio, duration, false, message);
      this.logger.error('Image generation failed', error instanceof Error ? error.stack : String(error));

      // Preserve explicit BadRequestException
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Map Google GenAI client 4xx errors to BadRequest for clearer client feedback
      try {
        const anyErr: any = error as any;
        // Common shapes to detect 4xx
        const status: number | undefined =
          typeof anyErr?.status === 'number' ? anyErr.status :
          typeof anyErr?.response?.status === 'number' ? anyErr.response.status :
          undefined;

        // Extract message if present in structured body
        const serviceMessage: string | undefined =
          anyErr?.response?.data?.error?.message ||
          anyErr?.error?.message ||
          undefined;

        if (status && status >= 400 && status < 500) {
          throw new BadRequestException(serviceMessage || message);
        }

        // Fallback: sometimes the client packs JSON into Error.message
        if (!status && typeof message === 'string' && message.trim().startsWith('{')) {
          const parsed = JSON.parse(message);
          const code = parsed?.error?.code;
          const parsedMsg = parsed?.error?.message as string | undefined;
          if (code && code >= 400 && code < 500) {
            throw new BadRequestException(parsedMsg || 'Invalid request');
          }
        }
      } catch (mappingErr) {
        if (mappingErr instanceof BadRequestException) {
          throw mappingErr;
        }
        // fallthrough to 500 if mapping failed
      }

      throw new InternalServerErrorException(message);
    }
  }

  // Generate using template prompt and optional reference images (URLs)
  async generateFromTemplate(prompt: string, imageUrls: string[] = []): Promise<GenerateImageResponseDto> {
    const startTime = Date.now();
    const aspectRatio = '1:1';
    const style = ImageStyle.PHOTOREALISTIC;

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('Missing GEMINI_API_KEY environment variable');
      throw new InternalServerErrorException('Missing GEMINI_API_KEY environment variable');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const styleEnhancement = this.stylePrompts[style];
      const aspectRatioEnhancement = this.getAspectRatioPrompt(aspectRatio);
      const enrichedPrompt = `You are an expert visual content generator.\n\nRequirements:\n- Use the provided reference images as primary visual guidance. Preserve key subjects, proportions, placement, and overall visual style.\n- Follow the prompt faithfully while respecting references.\n- Ensure all on-image text is correctly spelled and legible.\n- Output must be clear, concise, and visually coherent.\n\nSTYLE: ${styleEnhancement}\nCOMPOSITION: ${aspectRatioEnhancement}\nPROMPT: ${prompt}`;

      // Load reference images to base64 with mimeType if provided
      const refParts: any[] = [];
      for (const url of imageUrls.slice(0, 4)) {
        try {
          const res = await fetch(url as any, { cache: 'no-store' });
          const buf = await res.arrayBuffer();
          const b64 = Buffer.from(buf).toString('base64');
          const mime = (res.headers && (res.headers.get && res.headers.get('content-type'))) || 'image/png';
          refParts.push({ inlineData: { mimeType: typeof mime === 'string' ? mime : 'image/png', data: b64 } });
        } catch {}
      }

      this.logger.debug('Calling Gemini API with references', {
        model: 'gemini-2.5-flash-image-preview',
        refCount: refParts.length,
      });

      const response = await (ai.models as any).generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: [
          {
            role: 'user',
            parts: [...refParts, { text: enrichedPrompt }],
          },
        ],
        generationConfig: {
          temperature: 1.05,
          // Ask model for maximum variability while remaining faithful to references
          topK: 64,
          topP: 0.95,
        },
      });

      // Normalize to a candidates-like array regardless of SDK shape
      const candidates = (response as any)?.candidates ?? (Array.isArray((response as any)?.contents) ? (response as any).contents : []);
      let base64: string | undefined;
      if (Array.isArray(candidates)) {
        for (const cand of candidates) {
          const p = (cand?.content?.parts ?? cand?.parts ?? []) as any[];
          for (const part of p) {
            const data = part?.inlineData?.data || (part as any)?.inline_data?.data;
            if (data) { base64 = data as string; break; }
          }
          if (base64) break;
        }
      }

      if (!base64) {
        throw new BadRequestException('Gemini did not return image data.');
      }

      const { width, height } = this.getTargetDimensions(aspectRatio);
      const fittedBase64 = await this.fitImageToCanvas(`data:image/png;base64,${base64}`, width, height);
      const imageUrl = fittedBase64;
      const total = Date.now() - startTime;
      this.logger.log('Generated from template', { promptPreview: prompt.slice(0, 80), duration: `${total}ms` });
      return { success: true, imageUrl, message: 'Image generated from template' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      this.logger.error('Template-based generation failed', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException(message);
    }
  }

  async generateMultipleFromTemplate(prompt: string, imageUrls: string[] = [], count = 1): Promise<{ success: boolean; images: string[] }>{
    const capped = Math.max(1, Math.min(6, Math.floor(count)));
    // Staggered parallelism to avoid rate limits and increase variation
    const batches: Promise<GenerateImageResponseDto>[] = [];
    for (let i = 0; i < capped; i++) {
      batches.push(this.generateFromTemplate(`${prompt} (variation ${i + 1})`, imageUrls));
      // small delay between launches
      await new Promise((r) => setTimeout(r, 120));
    }
    const results = await Promise.allSettled(batches);
    const images: string[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value?.imageUrl) images.push(r.value.imageUrl);
    }
    return { success: images.length > 0, images };
  }

  // Generate an MP4 from a single AI-generated frame (MVP)
  async generateVideo(generateImageDto: GenerateImageDto & { duration?: number }): Promise<GenerateImageResponseDto> {
    const startTime = Date.now();
    const { aspectRatio = '1:1', duration = 5 } = generateImageDto;
    // Step 1: generate a fitted image at the target aspect ratio
    const image = await this.generateImage(generateImageDto);
    if (!image.success || !image.imageUrl) {
      return image;
    }

    try {
      const totalDurationStart = Date.now();
      const { width, height } = this.getTargetDimensions(aspectRatio);

      // Prepare temp files
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vc-video-'));
      const inputPng = path.join(tmpDir, 'frame.png');
      const outputMp4 = path.join(tmpDir, 'output.mp4');

      // Decode data URL and write PNG
      const base64Data = image.imageUrl.split(',')[1];
      const pngBuffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(inputPng, pngBuffer);

      // Use ffmpeg to create an H.264 MP4 of desired duration and size (static frame video)
      await new Promise<void>((resolve, reject) => {
        ffmpegLib()
          .input(inputPng)
          .inputOptions(['-loop 1'])
          .videoCodec('libx264')
          .size(`${width}x${height}`)
          .outputOptions([
            '-pix_fmt yuv420p',
            `-t ${Math.max(1, Math.min(60, Math.round(duration)))}`,
            '-r 30',
          ])
          .noAudio()
          .output(outputMp4)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      const mp4Buffer = await fs.readFile(outputMp4);
      const videoDataUrl = `data:video/mp4;base64,${mp4Buffer.toString('base64')}`;

      // Cleanup temp files
      try {
        await fs.unlink(inputPng);
        await fs.unlink(outputMp4);
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}

      const total = Date.now() - totalDurationStart;
      if (total > 15000) {
        this.logger.logPerformance('video-generation-slow', total, { aspectRatio, duration });
      }

      return {
        success: true,
        imageUrl: videoDataUrl,
        message: 'Video generated as MP4 from AI frame',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to render video';
      this.logger.error('Video generation failed', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException(message);
    } finally {
      const totalDuration = Date.now() - startTime;
      this.logger.log('Video generation finished', { duration: `${totalDuration}ms` });
    }
  }

  private getTargetDimensions(aspectRatio: string): { width: number; height: number } {
    const map: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '4:3': { width: 1600, height: 1200 },
      '3:4': { width: 1200, height: 1600 },
    };
    return map[aspectRatio] || { width: 1024, height: 1024 };
  }

  // Fit the generated image into the target canvas while preserving its intrinsic aspect ratio (contain)
  private async fitImageToCanvas(dataUrl: string, targetWidth: number, targetHeight: number): Promise<string> {
    try {
      const img = await loadImage(dataUrl);
      const canvas = createCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');

      // Optional: white background to avoid transparency artifacts
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const imgRatio = img.width / img.height;
      const targetRatio = targetWidth / targetHeight;

      let drawWidth = targetWidth;
      let drawHeight = targetHeight;

      if (imgRatio > targetRatio) {
        // Image is wider -> fit by width
        drawWidth = targetWidth;
        drawHeight = Math.round(targetWidth / imgRatio);
      } else {
        // Image is taller -> fit by height
        drawHeight = targetHeight;
        drawWidth = Math.round(targetHeight * imgRatio);
      }

      const offsetX = Math.round((targetWidth - drawWidth) / 2);
      const offsetY = Math.round((targetHeight - drawHeight) / 2);

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      return canvas.toDataURL('image/png');
    } catch (e) {
      // If anything goes wrong, fall back to original image
      this.logger.warn('Failed to fit image to target canvas, returning original image');
      return dataUrl;
    }
  }
}
