import { Module } from '@nestjs/common';
import { ImageEditingController } from './image-editing.controller';
import { ImageEditingService } from './image-editing.service';

@Module({
  controllers: [ImageEditingController],
  providers: [ImageEditingService]
})
export class ImageEditingModule {}
