import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../../entities/Agent';
import { AgentStep } from '../../entities/AgentStep';
import { AgentRun } from '../../entities/AgentRun';
import { AgentRunStep } from '../../entities/AgentRunStep';
import { Template } from '../../entities/Template';
import { AgentRunStatusEnum, AgentRunStepStatusEnum } from '../../enums';
import { FalAiService } from '../fal-ai/fal-ai.service';
import { GenerateImageDto, FalImageModel } from '../fal-ai/dto/fal-ai-base.dto';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(AgentStep)
    private readonly agentStepRepository: Repository<AgentStep>,
    @InjectRepository(AgentRun)
    private readonly agentRunRepository: Repository<AgentRun>,
    @InjectRepository(AgentRunStep)
    private readonly agentRunStepRepository: Repository<AgentRunStep>,
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    private readonly falAiService: FalAiService,
    private readonly creditsService: CreditsService,
  ) {}

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    if (!data.userId) {
      throw new Error('userId is required');
    }
    const agent = this.agentRepository.create({
      userId: data.userId,
      name: data.name ?? '',
      instructions: data.instructions ?? '',
      profileImageUrl: data.profileImageUrl ?? null,
      templateId: data.templateId ?? null,
    });
    return this.agentRepository.save(agent);
  }

  async updateAgent(agentId: string, data: Partial<Agent>): Promise<Agent> {
    const { template, steps, ...primitive } = data as any;
    await this.agentRepository.update({ id: agentId }, primitive);
    return this.agentRepository.findOneOrFail({ where: { id: agentId } });
  }

  async upsertSteps(agentId: string, steps: Array<Partial<AgentStep>>): Promise<AgentStep[]> {
    await this.agentStepRepository.delete({ agentId });
    const entities = steps.map((s, index) => this.agentStepRepository.create({
      agentId,
      stepIndex: s.stepIndex ?? index,
      instructions: s.instructions ?? '',
      images: s.images ?? null,
    }));
    return this.agentStepRepository.save(entities);
  }

  async findAgentById(agentId: string): Promise<Agent | null> {
    return this.agentRepository.findOne({ where: { id: agentId } });
  }

  async findAgentWithSteps(agentId: string): Promise<Agent & { steps: AgentStep[] } | null> {
    const agent = await this.agentRepository.findOne({ where: { id: agentId } });
    if (!agent) return null;

    const steps = await this.agentStepRepository.find({ 
      where: { agentId }, 
      order: { stepIndex: 'ASC' } 
    });

    return { ...agent, steps };
  }

  async listAgentsByUser(userId: string): Promise<Agent[]> {
    return this.agentRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async runAgent(agentId: string, userId: string): Promise<AgentRun> {
    // Verify agent exists and belongs to user
    const agent = await this.agentRepository.findOne({ where: { id: agentId, userId } });
    if (!agent) {
      throw new Error('Agent not found or access denied');
    }

    // Get agent steps
    const steps = await this.agentStepRepository.find({ 
      where: { agentId }, 
      order: { stepIndex: 'ASC' } 
    });

    // Calculate credits needed (estimate image steps) - DISABLED until migrations run
    const imageSteps = steps.filter(step => 
      this.detectImageGenerationIntent(step.instructions.toLowerCase()) ||
      agent.instructions.toLowerCase().includes('slideshow') ||
      agent.instructions.toLowerCase().includes('instagram')
    ).length;
    
    const creditsNeeded = this.creditsService.getAgentRunCost(steps.length, imageSteps);
    
    // Check if user has sufficient credits
    const hasSufficientCredits = await this.creditsService.checkSufficientCredits(userId, creditsNeeded);
    if (!hasSufficientCredits) {
      throw new HttpException(`Insufficient credits. Need ${creditsNeeded} credits to run this agent.`, HttpStatus.BAD_REQUEST);
    }

    // Create agent run
    const agentRun = this.agentRunRepository.create({
      agentId,
      userId,
      status: AgentRunStatusEnum.QUEUED,
      startedAt: null,
      finishedAt: null,
      parameters: { estimatedCredits: creditsNeeded },
    });
    const savedRun = await this.agentRunRepository.save(agentRun);

    // Create run steps
    const runSteps = steps.map((step, index) => 
      this.agentRunStepRepository.create({
        agentRunId: savedRun.id,
        agentStepId: step.id,
        stepIndex: index,
        status: AgentRunStepStatusEnum.PENDING,
      })
    );
    await this.agentRunStepRepository.save(runSteps);

    // Start processing asynchronously
    this.processAgentRun(savedRun.id).catch(console.error);

    return savedRun;
  }

  private async processAgentRun(runId: string): Promise<void> {
    let totalCreditsUsed = 0;
    let run: AgentRun | null = null;
    
    try {
      // Get run details
      run = await this.agentRunRepository.findOne({ where: { id: runId } });
      if (!run) throw new Error('Run not found');

      // Update run status to running
      await this.agentRunRepository.update(
        { id: runId }, 
        { status: AgentRunStatusEnum.RUNNING, startedAt: new Date() }
      );

      // Get run steps
      const runSteps = await this.agentRunStepRepository.find({
        where: { agentRunId: runId },
        order: { stepIndex: 'ASC' }
      });

      // Process each step
      for (const runStep of runSteps) {
        // Update step to running
        await this.agentRunStepRepository.update(
          { id: runStep.id },
          { status: AgentRunStepStatusEnum.RUNNING, startedAt: new Date() }
        );

        try {
          // Get the agent step details
          const agentStep = await this.agentStepRepository.findOne({ 
            where: { id: runStep.agentStepId || '' }
          });

          if (agentStep) {
            const result = await this.processAgentStep(agentStep, runId);
            
            // Calculate credits for this step
            const stepCredits = result.artifacts?.type === 'image' ? 15 : 5; // 15 for image steps, 5 for text steps
            totalCreditsUsed += stepCredits;
            
            // Update step with results
            await this.agentRunStepRepository.update(
              { id: runStep.id },
              { 
                status: AgentRunStepStatusEnum.SUCCEEDED, 
                finishedAt: new Date(),
                output: result.output,
                artifacts: result.artifacts
              }
            );
          } else {
            // No step found, mark as skipped
            await this.agentRunStepRepository.update(
              { id: runStep.id },
              { 
                status: AgentRunStepStatusEnum.SKIPPED, 
                finishedAt: new Date(),
                output: 'Step configuration not found'
              }
            );
          }
        } catch (stepError) {
          // Mark step as failed
          await this.agentRunStepRepository.update(
            { id: runStep.id },
            { 
              status: AgentRunStepStatusEnum.FAILED, 
              finishedAt: new Date(),
              errorMessage: stepError instanceof Error ? stepError.message : 'Unknown error',
              output: 'Step processing failed'
            }
          );
        }
      }

      // Deduct credits for successful run
      if (totalCreditsUsed > 0 && run) {
        await this.creditsService.deductCredits(
          run.userId,
          totalCreditsUsed,
          `Agent run: ${totalCreditsUsed} credits used`,
          runId,
          'agent'
        );
      }

      // Update run status to completed with credit info
      await this.agentRunRepository.update(
        { id: runId },
        { 
          status: AgentRunStatusEnum.SUCCEEDED, 
          finishedAt: new Date(),
          creditsUsed: totalCreditsUsed,
          parameters: { ...run?.parameters, actualCreditsUsed: totalCreditsUsed }
        }
      );

    } catch (error) {
      // Mark run as failed (don't charge credits for failed runs)
      await this.agentRunRepository.update(
        { id: runId },
        { 
          status: AgentRunStatusEnum.FAILED, 
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          creditsUsed: 0, // No credits charged for failed runs
          parameters: run ? { ...run.parameters, actualCreditsUsed: totalCreditsUsed } : undefined
        }
      );
    }
  }

  async getRunStatus(runId: string): Promise<any> {
    const run = await this.agentRunRepository.findOne({ where: { id: runId } });
    if (!run) {
      throw new Error('Run not found');
    }

    const steps = await this.agentRunStepRepository.find({
      where: { agentRunId: runId },
      order: { stepIndex: 'ASC' }
    });

    return {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      errorMessage: run.errorMessage,
      steps: steps.map(step => ({
        id: step.id,
        stepIndex: step.stepIndex,
        status: step.status,
        output: step.output,
        artifacts: step.artifacts,
        startedAt: step.startedAt,
        finishedAt: step.finishedAt,
        errorMessage: step.errorMessage,
      }))
    };
  }

  async getUserAgentRuns(userId: string): Promise<AgentRun[]> {
    return this.agentRunRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
      relations: ['agent']
    });
  }

  private async processAgentStep(agentStep: AgentStep, runId: string): Promise<{ output: string; artifacts?: any }> {
    const instructions = agentStep.instructions.toLowerCase();
    
    // Get the agent to check if it's a visual/slideshow agent
    const run = await this.agentRunRepository.findOne({ where: { id: runId } });
    const agent = run ? await this.agentRepository.findOne({ where: { id: run.agentId } }) : null;
    const isVisualAgent = agent?.instructions.toLowerCase().includes('slideshow') || 
                         agent?.instructions.toLowerCase().includes('instagram') ||
                         agent?.instructions.toLowerCase().includes('visual') ||
                         agent?.instructions.toLowerCase().includes('image');
    
    // Detect if this step requires image generation
    const needsImageGeneration = this.detectImageGenerationIntent(instructions) || 
                                 (isVisualAgent && agentStep.stepIndex < 10); // For visual agents, assume most steps need images
    
    console.log(`Step ${agentStep.stepIndex + 1}: "${agentStep.instructions}" -> Image generation: ${needsImageGeneration}`);
    
    if (needsImageGeneration) {
      return await this.generateImageForStep(agentStep, runId);
    } else {
      // For non-image steps, simulate text processing
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      return {
        output: `Processed: ${agentStep.instructions.slice(0, 100)}${agentStep.instructions.length > 100 ? '...' : ''}`,
        artifacts: {
          type: 'text',
          content: `Step completed: ${agentStep.instructions}`
        }
      };
    }
  }

  private detectImageGenerationIntent(instructions: string): boolean {
    const imageKeywords = [
      // Direct image generation terms
      'generate image', 'create image', 'make image', 'produce image',
      'generate photo', 'create photo', 'make photo', 'produce photo',
      'generate picture', 'create picture', 'make picture', 'produce picture',
      'generate visual', 'create visual', 'make visual', 'produce visual',
      'design image', 'design photo', 'design picture', 'design visual',
      
      // Content creation terms
      'image of', 'photo of', 'picture of', 'visual of',
      'show', 'display', 'illustrate', 'depict', 'render',
      
      // Social media specific
      'slideshow', 'slide', 'instagram post', 'social media', 'post',
      'instagram', 'facebook', 'twitter', 'tiktok', 'story',
      
      // Content types that typically need images
      'hook image', 'hook', 'background', 'banner', 'header',
      'thumbnail', 'cover', 'poster', 'graphic', 'artwork',
      'call to action', 'cta', 'button', 'promo',
      
      // Food/content specific (from the example)
      'food', 'recipe', 'cooking', 'kitchen', 'meal', 'dish',
      'app', 'download', 'pantry', 'ingredient'
    ];

    // Also check if the instruction is asking for visual content
    const visualContentIndicators = [
      'with', 'showing', 'featuring', 'containing', 'including',
      'background', 'scene', 'setting', 'environment'
    ];

    const hasImageKeyword = imageKeywords.some(keyword => instructions.includes(keyword));
    const hasVisualIndicator = visualContentIndicators.some(indicator => instructions.includes(indicator));
    
    // If it mentions visual elements or is describing something to be shown, it likely needs an image
    const looksLikeImageDescription = hasVisualIndicator && (
      instructions.includes('image') || 
      instructions.includes('visual') || 
      instructions.includes('show') ||
      instructions.length > 20 // Longer descriptions often describe visual content
    );

    return hasImageKeyword || looksLikeImageDescription;
  }

  private async generateImageForStep(agentStep: AgentStep, runId: string): Promise<{ output: string; artifacts: any }> {
    try {
      // Get the agent and template context
      const run = await this.agentRunRepository.findOne({ where: { id: runId } });
      const agent = run ? await this.agentRepository.findOne({ where: { id: run.agentId } }) : null;
      const template = agent?.templateId ? await this.templateRepository.findOne({ where: { id: agent.templateId } }) : null;
      
      // Extract reference images from multiple sources
      const stepImages = this.extractImageUrls(agentStep.images);
      const templateImages = template ? this.extractImageUrls(template.images) : [];
      const allReferenceImages = [...stepImages, ...templateImages];
      
      // Create enhanced prompt combining step, agent, and template context
      const enhancedPrompt = this.createEnhancedPromptWithAllContext(
        agentStep.instructions, 
        agent?.instructions || '', 
        template?.prompt || '',
        agentStep.stepIndex,
        allReferenceImages.length > 0
      );
      
      // Use the first available reference image (prioritize step images, then template images)
      const primaryReferenceImage = stepImages.length > 0 ? stepImages[0] : 
                                   templateImages.length > 0 ? templateImages[0] : 
                                   undefined;
      
      const generateDto: GenerateImageDto = {
        prompt: enhancedPrompt,
        num_images: 1,
        aspect_ratio: '1:1', // Default to square for social media
        model: FalImageModel.NANO_BANANA,
        image_url: primaryReferenceImage,
        strength: primaryReferenceImage ? 0.75 : undefined, // Higher influence when we have references
        guidance_scale: 7.5, // Good balance for creative control
        num_inference_steps: 30, // Quality vs speed balance
      };

      console.log(`Generating image for step ${agentStep.stepIndex + 1}:`);
      console.log(`- Enhanced prompt: ${enhancedPrompt.slice(0, 300)}...`);
      console.log(`- Reference image: ${primaryReferenceImage || 'None'}`);
      console.log(`- Step images: ${stepImages.length}, Template images: ${templateImages.length}`);

      const result = await this.falAiService.generateImage(generateDto);
      
      if (result.images && result.images.length > 0) {
        const generatedImage = result.images[0];
        
        return {
          output: `Generated image successfully: ${generatedImage.width}x${generatedImage.height}px using ${primaryReferenceImage ? 'reference image' : 'text prompt only'}`,
          artifacts: {
            type: 'image',
            url: generatedImage.url,
            width: generatedImage.width,
            height: generatedImage.height,
            prompt: enhancedPrompt,
            model: FalImageModel.NANO_BANANA,
            seed: result.seed,
            stepImages: stepImages,
            templateImages: templateImages,
            primaryReference: primaryReferenceImage,
            stepInstructions: agentStep.instructions,
            templatePrompt: template?.prompt,
            agentInstructions: agent?.instructions
          }
        };
      } else {
        throw new Error('No images generated');
      }
    } catch (error) {
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractImageUrls(images: unknown, maxDepth = 3): string[] {
    const urls: string[] = [];
    const visit = (val: any, depth: number) => {
      if (depth < 0 || val == null) return;
      if (typeof val === 'string') {
        if (val.startsWith('http') || val.startsWith('https') || val.startsWith('data:')) urls.push(val);
        return;
      }
      if (Array.isArray(val)) {
        for (const v of val) visit(v, depth - 1);
        return;
      }
      if (typeof val === 'object') {
        if (typeof val.url === 'string') {
          urls.push(val.url);
        }
        for (const key of Object.keys(val)) {
          if (key === 'url') continue;
          visit(val[key], depth - 1);
        }
      }
    };
    visit(images as any, maxDepth);
    return Array.from(new Set(urls.filter(Boolean)));
  }

  private createEnhancedPromptWithContext(
    stepInstructions: string, 
    agentInstructions: string, 
    stepIndex: number,
    hasReferenceImages: boolean
  ): string {
    // Determine the type of content based on agent and step context
    let contextualGuidance = '';
    
    if (agentInstructions.toLowerCase().includes('slideshow') || agentInstructions.toLowerCase().includes('instagram')) {
      if (stepIndex === 0) {
        contextualGuidance = 'This is the HOOK/OPENING slide - make it eye-catching and attention-grabbing to stop scrolling.';
      } else if (stepInstructions.toLowerCase().includes('call to action') || stepInstructions.toLowerCase().includes('cta')) {
        contextualGuidance = 'This is a CALL TO ACTION slide - include clear, actionable visual elements that encourage engagement.';
      } else {
        contextualGuidance = 'This is a CONTENT slide - focus on clear, engaging visuals that support the message.';
      }
    }

    const basePrompt = hasReferenceImages ? 
      `You are a professional AI image generator creating high-quality visual content for social media.

AGENT CONTEXT: ${agentInstructions}
STEP TASK: ${stepInstructions}
${contextualGuidance}

REFERENCE IMAGE INSTRUCTIONS:
- Analyze the provided reference image(s) for style, lighting, color palette, and composition
- Apply the visual style while creating content that matches the task requirements
- Maintain consistency with reference aesthetics while expressing the new concept

QUALITY REQUIREMENTS:
- Professional, high-resolution output optimized for social media engagement
- Vibrant but natural colors with proper contrast and visual appeal
- Clear focal points and strong composition following design principles
- Consistent branding and visual style across the slideshow
- Text-friendly composition with space for overlays if needed

Create a visually striking image that effectively communicates the concept while maintaining professional quality and social media best practices.` :
      `You are a professional AI image generator creating high-quality visual content for social media.

AGENT CONTEXT: ${agentInstructions}
STEP TASK: ${stepInstructions}
${contextualGuidance}

QUALITY REQUIREMENTS:
- Professional, high-resolution output optimized for social media engagement
- Vibrant but natural colors with proper contrast and visual appeal
- Clear focal points and strong composition following design principles
- Well-balanced lighting that enhances the subject matter
- Text-friendly composition with space for overlays if needed
- Consistent visual style appropriate for the content type

Create a visually striking image that effectively communicates the concept with professional quality and social media optimization.`;

    return basePrompt;
  }

  private createEnhancedPromptWithAllContext(
    stepInstructions: string,
    agentInstructions: string,
    templatePrompt: string,
    stepIndex: number,
    hasReferenceImages: boolean
  ): string {
    // Determine the type of content based on agent and step context
    let contextualGuidance = '';
    
    if (agentInstructions.toLowerCase().includes('slideshow') || agentInstructions.toLowerCase().includes('instagram')) {
      if (stepIndex === 0) {
        contextualGuidance = 'This is the HOOK/OPENING slide - make it eye-catching and attention-grabbing to stop scrolling.';
      } else if (stepInstructions.toLowerCase().includes('call to action') || stepInstructions.toLowerCase().includes('cta')) {
        contextualGuidance = 'This is a CALL TO ACTION slide - include clear, actionable visual elements that encourage engagement.';
      } else {
        contextualGuidance = 'This is a CONTENT slide - focus on clear, engaging visuals that support the message.';
      }
    }

    // Build comprehensive context
    let contextSection = `AGENT CONTEXT: ${agentInstructions}`;
    if (templatePrompt) {
      contextSection += `\nTEMPLATE CONTEXT: ${templatePrompt}`;
    }
    contextSection += `\nSTEP TASK: ${stepInstructions}`;
    if (contextualGuidance) {
      contextSection += `\nSLIDE TYPE: ${contextualGuidance}`;
    }

    const referenceSection = hasReferenceImages ? `
REFERENCE IMAGE INSTRUCTIONS:
- Analyze the provided reference image(s) for style, lighting, color palette, and composition
- Apply the visual style while creating content that matches the task requirements
- Maintain consistency with reference aesthetics while expressing the new concept
- If template images are provided, use them as style guides for the overall look and feel
- If step images are provided, they take priority for specific visual elements` : '';

    return `You are a professional AI image generator creating high-quality visual content for social media.

${contextSection}
${referenceSection}

QUALITY REQUIREMENTS:
- Professional, high-resolution output optimized for social media engagement
- Vibrant but natural colors with proper contrast and visual appeal
- Clear focal points and strong composition following design principles
- Consistent branding and visual style across the slideshow
- Text-friendly composition with space for overlays if needed
- Match the visual style established by any reference images

FINAL INSTRUCTION: Create a visually striking image that effectively communicates the step concept while maintaining consistency with the agent's purpose${templatePrompt ? ' and template style' : ''}.`;
  }

  private createEnhancedPrompt(originalInstructions: string, hasReferenceImages: boolean): string {
    return this.createEnhancedPromptWithAllContext(originalInstructions, '', '', 0, hasReferenceImages);
  }
}


