import { Body, Controller, Headers, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckoutSession(
    @Body() body: { userId: string; priceId?: string; productId?: string },
  ): Promise<{ sessionUrl: string }> {
    if (body.productId) {
      return this.billingService.createSubscriptionFromProduct(body.userId, body.productId);
    }
    if (!body.priceId) throw new Error('priceId or productId required');
    return this.billingService.createSubscriptionFromCheckout(body.userId, body.priceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('credits/checkout')
  async createCreditsCheckout(
    @Body() body: { userId: string; productId: string },
  ): Promise<{ sessionUrl: string }> {
    return this.billingService.createOneTimeCreditsCheckout(body.userId, body.productId);
  }
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly billingService: BillingService) {}

  @Post('stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    await this.billingService.handleStripeWebhook(req.rawBody as Buffer, signature);
    return { received: true };
  }
}


