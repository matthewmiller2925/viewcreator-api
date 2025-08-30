import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ImageVariationService } from './image-variation.service';
import { GenerateVariationDto, GenerateVariationResponseDto } from './dto/generate-variation.dto';

@Controller('image-variation')
export class ImageVariationController {
  constructor(private readonly imageVariationService: ImageVariationService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateVariation(@Body() generateVariationDto: GenerateVariationDto): Promise<GenerateVariationResponseDto> {
    return this.imageVariationService.generateVariation(generateVariationDto);
  }
}
