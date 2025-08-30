import { Test, TestingModule } from '@nestjs/testing';
import { ImageEditingController } from './image-editing.controller';

describe('ImageEditingController', () => {
  let controller: ImageEditingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageEditingController],
    }).compile();

    controller = module.get<ImageEditingController>(ImageEditingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
