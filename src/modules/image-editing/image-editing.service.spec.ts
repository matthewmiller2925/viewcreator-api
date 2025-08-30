import { Test, TestingModule } from '@nestjs/testing';
import { ImageEditingService } from './image-editing.service';

describe('ImageEditingService', () => {
  let service: ImageEditingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageEditingService],
    }).compile();

    service = module.get<ImageEditingService>(ImageEditingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
