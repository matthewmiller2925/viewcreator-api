import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from '../../entities/Template';
import { TemplateJob } from '../../entities/TemplateJob';
import { TemplateJobStatusEnum } from '../../enums';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';

interface CreateTemplateParams {
  prompt: string;
  images?: unknown;
}

@Injectable()
export class TemplatesService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    @InjectRepository(Template) private readonly templateRepository: Repository<Template>,
    @InjectRepository(TemplateJob) private readonly templateJobRepository: Repository<TemplateJob>,
    configService: ConfigService,
    private readonly creditsService: CreditsService,
  ) {
    this.bucket = configService.get<string>('AWS_S3_BUCKET') || '';
    this.region = configService.get<string>('AWS_REGION') || 'us-east-1';
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async createTemplate(params: CreateTemplateParams) {
    const template = this.templateRepository.create({ prompt: params.prompt, images: params.images });
    return this.templateRepository.save(template);
  }

  async listTemplates() {
    return this.templateRepository.find({ order: { createdAt: 'DESC' } });
  }

  async createPresignedUploadUrls(params: { files: { key: string; contentType: string }[] }) {
    const urls = await Promise.all(
      params.files.map(async (file) => {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: file.key,
          ContentType: file.contentType,
        });
        const url = await getSignedUrl(this.s3, command, { expiresIn: 60 * 5 });
        const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${file.key}`;
        return { key: file.key, uploadUrl: url, publicUrl };
      }),
    );
    return { urls };
  }

  async getTemplateById(id: string) {
    return this.templateRepository.findOne({ where: { id } });
  }

  async createTemplateJob(templateId: string, userId: string, parameters: any): Promise<TemplateJob> {
    // Calculate credits needed
    const count = Math.max(1, Math.min(6, Number(parameters?.count) || 1));
    const creditsNeeded = this.creditsService.getImageGenerationCost(count);
    
    // Check if user has sufficient credits
    const hasSufficientCredits = await this.creditsService.checkSufficientCredits(userId, creditsNeeded);
    if (!hasSufficientCredits) {
      throw new Error(`Insufficient credits. Need ${creditsNeeded} credits to generate ${count} image(s).`);
    }

    // Create template job
    const job = this.templateJobRepository.create({
      templateId,
      userId,
      status: TemplateJobStatusEnum.QUEUED,
      parameters,
      creditsUsed: 0, // Will be updated after successful generation
    });

    return this.templateJobRepository.save(job);
  }

  async updateTemplateJob(jobId: string, updates: Partial<TemplateJob>): Promise<void> {
    await this.templateJobRepository.update({ id: jobId }, updates);
  }

  async getTemplateJobs(userId: string, limit: number = 50): Promise<TemplateJob[]> {
    return this.templateJobRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['template']
    });
  }
}


