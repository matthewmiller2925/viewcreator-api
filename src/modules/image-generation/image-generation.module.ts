import { Module } from '@nestjs/common';
import { ImageGenerationController } from './image-generation.controller';
import { ImageGenerationService } from './image-generation.service';

@Module({
  controllers: [ImageGenerationController],
  providers: [ImageGenerationService]
})
export class ImageGenerationModule {}
