import { Test, TestingModule } from '@nestjs/testing';
import { ImageVariationService } from './image-variation.service';

describe('ImageVariationService', () => {
  let service: ImageVariationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageVariationService],
    }).compile();

    service = module.get<ImageVariationService>(ImageVariationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
