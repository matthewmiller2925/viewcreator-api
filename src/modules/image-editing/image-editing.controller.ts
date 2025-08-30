import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ImageEditingService } from './image-editing.service';
import { EditImageDto, EditImageResponseDto } from './dto/edit-image.dto';

@Controller('image-editing')
export class ImageEditingController {
  constructor(private readonly imageEditingService: ImageEditingService) {}

  @Post('edit')
  @HttpCode(HttpStatus.OK)
  async editImage(@Body() editImageDto: EditImageDto): Promise<EditImageResponseDto> {
    return this.imageEditingService.editImage(editImageDto);
  }
}
