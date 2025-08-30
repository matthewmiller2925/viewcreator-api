# ViewCreator API

A NestJS-based API server for the ViewCreator platform, providing image generation, variation, and editing capabilities.

## Features

- **Image Generation**: Generate images using Google Gemini AI with various styles and aspect ratios
- **Image Variation**: Create variations of existing images with different styles, lighting, composition, etc.
- **Image Editing**: Add text overlays to images with customizable fonts, colors, and positioning
- **Modular Architecture**: Clean, maintainable code structure with separate modules for each feature
- **Validation**: Request validation using class-validator
- **Environment Configuration**: Centralized configuration management
- **CORS Support**: Cross-origin resource sharing enabled for frontend integration

## API Endpoints

### Image Generation
- `POST /api/image-generation/generate`
  - Generate images from text prompts
  - Supports various styles: photorealistic, professional-photo, graphic-design, digital-art, etc.
  - Customizable aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4, or custom ratios

### Image Variation
- `POST /api/image-variation/generate`
  - Create variations of existing images
  - Variation types: color-shift, style-change, lighting, composition, mood, detailed, simplified, abstract

### Image Editing
- `POST /api/image-editing/edit`
  - Add text overlays to images
  - Customizable text properties: font, size, color, position, rotation, opacity

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `PORT`: Server port (default: 3001)
   - `CORS_ORIGIN`: Frontend URL for CORS (default: http://localhost:3000)

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at `http://localhost:3001/api`

## Project Structure

```
src/
├── modules/
│   ├── common/           # Shared DTOs and utilities
│   ├── image-generation/ # Image generation functionality
│   ├── image-variation/  # Image variation functionality
│   └── image-editing/    # Image editing functionality
├── app.module.ts         # Main application module
└── main.ts              # Application bootstrap
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `GEMINI_API_KEY`: Google Gemini API key for image generation
- `CORS_ORIGIN`: Allowed CORS origin (default: http://localhost:3000)

## Technologies Used

- **NestJS**: Progressive Node.js framework
- **TypeScript**: Type-safe JavaScript
- **Google Gemini AI**: Image generation capabilities
- **Canvas**: Image editing and text overlay functionality
- **class-validator**: Request validation
- **@nestjs/config**: Configuration management

## License

MIT