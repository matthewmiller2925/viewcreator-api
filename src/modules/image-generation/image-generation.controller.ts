import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ImageGenerationService } from './image-generation.service';
import { GenerateImageDto, GenerateImageResponseDto } from './dto/generate-image.dto';

@Controller('image-generation')
export class ImageGenerationController {
  constructor(private readonly imageGenerationService: ImageGenerationService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateImage(@Body() generateImageDto: GenerateImageDto): Promise<GenerateImageResponseDto> {
    return this.imageGenerationService.generateImage(generateImageDto);
  }

  @Post('generate-video')
  @HttpCode(HttpStatus.OK)
  async generateVideo(@Body() generateImageDto: GenerateImageDto & { duration?: number }): Promise<GenerateImageResponseDto> {
    return this.imageGenerationService.generateVideo(generateImageDto);
  }
}
