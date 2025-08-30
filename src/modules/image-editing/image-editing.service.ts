import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import { EditImageDto, EditImageResponseDto } from './dto/edit-image.dto';
import { CustomLoggerService } from '../../common/logger';

@Injectable()
export class ImageEditingService {
  constructor(private logger: CustomLoggerService) {
    this.logger.setContext('ImageEditingService');
  }
  async editImage(editImageDto: EditImageDto): Promise<EditImageResponseDto> {
    const startTime = Date.now();
    const { imageUrl, textOverlays } = editImageDto;

    this.logger.log(`Starting image editing`, {
      overlayCount: textOverlays.length,
      imageType: imageUrl.startsWith('data:') ? 'base64' : 'url',
      overlayTexts: textOverlays.map(o => o.text).slice(0, 3), // Log first 3 overlay texts
    });

    try {
      this.logger.debug('Loading original image');
      const imageLoadStart = Date.now();
      
      // Load the original image
      const originalImage = await loadImage(imageUrl);
      const imageLoadDuration = Date.now() - imageLoadStart;
      
      this.logger.debug('Image loaded successfully', {
        width: originalImage.width,
        height: originalImage.height,
        loadTime: `${imageLoadDuration}ms`,
      });
      
      // Create a canvas with the same dimensions as the original image
      const canvas = createCanvas(originalImage.width, originalImage.height);
      const ctx = canvas.getContext('2d');

      // Draw the original image
      ctx.drawImage(originalImage, 0, 0);

      this.logger.debug('Applying text overlays', { count: textOverlays.length });

      // Apply text overlays
      textOverlays.forEach((overlay, index) => {
        const { text, x, y, fontSize, color, fontFamily, fontWeight, rotation, opacity } = overlay;
        
        this.logger.debug(`Applying overlay ${index + 1}`, {
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          position: `${x}%, ${y}%`,
          fontSize,
          color,
          fontFamily,
        });
        
        ctx.save();
        
        // Set opacity
        ctx.globalAlpha = opacity;
        
        // Set font
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Apply rotation and position
        const centerX = (x / 100) * canvas.width;
        const centerY = (y / 100) * canvas.height;
        
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        
        // Add text shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw the text
        ctx.fillText(text, 0, 0);
        
        ctx.restore();
      });

      this.logger.debug('Converting canvas to base64');
      const conversionStart = Date.now();
      
      // Convert canvas to base64
      const editedImageBase64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      const editedImageUrl = `data:image/png;base64,${editedImageBase64}`;
      
      const conversionDuration = Date.now() - conversionStart;
      const totalDuration = Date.now() - startTime;

      this.logger.logImageEditing(textOverlays.length, totalDuration, true);
      
      this.logger.debug('Image editing completed', {
        conversionTime: `${conversionDuration}ms`,
        totalTime: `${totalDuration}ms`,
        outputSize: `${Math.round(editedImageBase64.length / 1024)}KB`,
      });

      // Log performance metrics for slow operations
      if (totalDuration > 5000) {
        this.logger.logPerformance('image-editing-slow', totalDuration, {
          overlayCount: textOverlays.length,
          imageSize: `${originalImage.width}x${originalImage.height}`,
        });
      }

      return {
        success: true,
        editedImageUrl,
        message: 'Image edited successfully',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      this.logger.logImageEditing(textOverlays.length, duration, false, message);
      this.logger.error('Image editing failed', error instanceof Error ? error.stack : String(error));
      
      // Log specific error types
      if (message.includes('Invalid image')) {
        this.logger.logSecurityEvent('invalid-image-upload', 'medium', {
          imageUrl: imageUrl.substring(0, 100) + '...',
          error: message,
        });
      }
      
      throw new InternalServerErrorException(message);
    }
  }
}
