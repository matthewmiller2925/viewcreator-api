import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CustomLoggerService } from '../../common/logger';
import { ImageGenerationService } from '../image-generation/image-generation.service';

class CreateTemplateDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  images?: unknown;
}

@Controller('templates')
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly logger: CustomLoggerService,
    private readonly imageGenerationService: ImageGenerationService,
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
  async generateFromTemplate(@Param('id') id: string, @Body() body?: { count?: number }) {
    const tpl = await this.templatesService.getTemplateById(id);
    if (!tpl) return { success: false, error: 'Template not found' };
    const refs: string[] = this.extractImageUrls(tpl.images);
    const count = Math.max(1, Math.min(6, Number(body?.count) || 1));
    if (count === 1) {
      return (this.imageGenerationService as any).generateFromTemplate(tpl.prompt, refs);
    }
    return (this.imageGenerationService as any).generateMultipleFromTemplate(tpl.prompt, refs, count);
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
}


