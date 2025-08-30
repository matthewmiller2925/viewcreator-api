import { Test, TestingModule } from '@nestjs/testing';
import { ImageVariationController } from './image-variation.controller';

describe('ImageVariationController', () => {
  let controller: ImageVariationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageVariationController],
    }).compile();

    controller = module.get<ImageVariationController>(ImageVariationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
