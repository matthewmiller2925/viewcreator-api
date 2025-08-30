import { Module } from '@nestjs/common';
import { ImageVariationController } from './image-variation.controller';
import { ImageVariationService } from './image-variation.service';

@Module({
  controllers: [ImageVariationController],
  providers: [ImageVariationService]
})
export class ImageVariationModule {}
