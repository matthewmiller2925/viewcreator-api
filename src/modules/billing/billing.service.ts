import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { User } from '../../entities/User';
import { Subscription } from '../../entities/Subscription';
import { SubscriptionStatusEnum } from '../../enums';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subsRepo: Repository<Subscription>,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeSecretKey || '', { apiVersion: '2024-12-18.acacia' as any });
  }

  async ensureStripeCustomer(userId: string): Promise<User> {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    if (user.stripeCustomerId) return user;

    const customer = await this.stripe.customers.create({ email: user.email });
    user.stripeCustomerId = customer.id;
    await this.usersRepo.save(user);
    return user;
  }

  async createSubscriptionFromCheckout(userId: string, priceId: string): Promise<{ sessionUrl: string }> {
    const user = await this.ensureStripeCustomer(userId);
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: user.stripeCustomerId as string,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.configService.get<string>('STRIPE_SUCCESS_URL') || 'http://localhost:3000/account',
      cancel_url: this.configService.get<string>('STRIPE_CANCEL_URL') || 'http://localhost:3000/pricing',
      allow_promotion_codes: true,
    });

    const subscription = this.subsRepo.create({
      userId,
      status: SubscriptionStatusEnum.INCOMPLETE,
      stripePriceId: priceId,
    });
    await this.subsRepo.save(subscription);

    return { sessionUrl: session.url as string };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown webhook error';
      throw new Error(`Stripe webhook signature verification failed: ${errorMessage}`);
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubscriptionId = subscription.id;
        const status = (subscription.status || 'incomplete') as SubscriptionStatusEnum;
        const currentPeriodStart = (subscription as any).current_period_start
          ? new Date((subscription as any).current_period_start * 1000)
          : null;
        const currentPeriodEnd = (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000)
          : null;

        const stripeCustomerId = subscription.customer as string;
        const user = await this.usersRepo.findOne({ where: { stripeCustomerId } });
        if (!user) return;

        const existing = await this.subsRepo.findOne({ where: { stripeSubscriptionId } });
        if (existing) {
          existing.status = status;
          existing.currentPeriodStart = currentPeriodStart;
          existing.currentPeriodEnd = currentPeriodEnd;
          existing.stripeProductId = subscription.items?.data?.[0]?.price?.product as string | undefined;
          existing.stripePriceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
          await this.subsRepo.save(existing);
        } else {
          const created = this.subsRepo.create({
            userId: user.id,
            stripeSubscriptionId,
            status,
            currentPeriodStart,
            currentPeriodEnd,
            stripeProductId: subscription.items?.data?.[0]?.price?.product as string | undefined,
            stripePriceId: subscription.items?.data?.[0]?.price?.id as string | undefined,
          });
          await this.subsRepo.save(created);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const existing = await this.subsRepo.findOne({ where: { stripeSubscriptionId: subscription.id } });
        if (existing) {
          existing.status = SubscriptionStatusEnum.CANCELED;
          await this.subsRepo.save(existing);
        }
        break;
      }
      case 'checkout.session.completed': {
        // Optional: could use this to connect session to our provisional subscription row
        break;
      }
      default:
        break;
    }
  }
}


