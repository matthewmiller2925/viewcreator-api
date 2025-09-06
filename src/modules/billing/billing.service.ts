import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { User } from '../../entities/User';
import { Subscription } from '../../entities/Subscription';
import { CreditTransaction } from '../../entities/CreditTransaction';
import { CreditTransactionTypeEnum } from '../../enums';
import { CreditsService } from '../credits/credits.service';
import { SubscriptionStatusEnum } from '../../enums';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subsRepo: Repository<Subscription>,
    @InjectRepository(CreditTransaction) private readonly transactionsRepo: Repository<CreditTransaction>,
    private readonly creditsService: CreditsService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeSecretKey || '', { apiVersion: '2024-12-18.acacia' as any });
  }

  // Map Stripe product ID to credit amount (keep in sync with frontend constants)
  private mapProductToCredits(productId: string): number {
    const mapping: Record<string, number> = {
      // One-time credit products
      'prod_T0Q0egYs4uRQIF': 100,   // 100 Credits
      'prod_T0Q4ubm8cwuJFW': 260,   // 260 Credits (250 + 10 bonus)
      'prod_T0Q5vfk643vdUe': 525,   // 525 Credits (500 + 25 bonus)
      'prod_T0Q5DPrrdQ9RV7': 1075,  // 1,075 Credits (1000 + 75 bonus)
    }
    return mapping[productId] || 0
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

  async createSubscriptionFromProduct(userId: string, productId: string): Promise<{ sessionUrl: string }> {
    const product = await this.stripe.products.retrieve(productId);
    const defaultPriceId = (product.default_price as string) || '';
    if (!defaultPriceId) {
      throw new Error('Product has no default price configured');
    }
    return this.createSubscriptionFromCheckout(userId, defaultPriceId);
  }

  async createOneTimeCreditsCheckout(userId: string, productId: string): Promise<{ sessionUrl: string }> {
    const user = await this.ensureStripeCustomer(userId);

    // Use the product's default price
    const product = await this.stripe.products.retrieve(productId);
    const defaultPriceId = (product.default_price as string) || '';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer: user.stripeCustomerId as string,
      line_items: [{ price: defaultPriceId, quantity: 1 }],
      success_url: this.configService.get<string>('STRIPE_SUCCESS_URL') || 'http://localhost:3000/credits?status=success',
      cancel_url: this.configService.get<string>('STRIPE_CANCEL_URL') || 'http://localhost:3000/credits?status=cancel',
      allow_promotion_codes: true,
      metadata: {
        userId,
        productId,
        // Optional: attach credits mapping on session for safety
      },
    });

    // Optimistically store a pending transaction record for traceability
    await this.transactionsRepo.save(this.transactionsRepo.create({
      userId,
      type: CreditTransactionTypeEnum.PURCHASE,
      amount: 0,
      balanceAfter: 0,
      description: 'Pending credit purchase',
      stripeSessionId: session.id,
      stripeProductId: productId,
      stripePriceId: defaultPriceId,
      metadata: { stage: 'checkout_created' },
    }));

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
      case 'invoice.payment_succeeded': {
        // Guard against missed subscription events; ensure sub row reflects latest
        const invoice = event.data.object as Stripe.Invoice;
        // In some Stripe API typings, "subscription" may not be on Invoice; access defensively
        const subscriptionId = (invoice as any).subscription as string | undefined;
        if (subscriptionId) {
          const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
          const stripeCustomerId = subscription.customer as string;
          const user = await this.usersRepo.findOne({ where: { stripeCustomerId } });
          if (user) {
            const existing = await this.subsRepo.findOne({ where: { stripeSubscriptionId: subscriptionId } });
            const status = (subscription.status || 'incomplete') as SubscriptionStatusEnum;
            const currentPeriodStart = (subscription as any).current_period_start
              ? new Date((subscription as any).current_period_start * 1000)
              : null;
            const currentPeriodEnd = (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000)
              : null;
            if (existing) {
              existing.status = status;
              existing.currentPeriodStart = currentPeriodStart;
              existing.currentPeriodEnd = currentPeriodEnd;
              existing.stripeProductId = subscription.items?.data?.[0]?.price?.product as string | undefined;
              existing.stripePriceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
              await this.subsRepo.save(existing);
            }
          }
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
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'payment') {
          const stripeCustomerId = session.customer as string;
          const user = await this.usersRepo.findOne({ where: { stripeCustomerId } });
          if (!user) break;

          // Resolve product and price from session
          const lineItems = await this.stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const item = lineItems.data[0];
          const priceId = item?.price?.id as string | undefined;
          const productId = item?.price?.product as string | undefined;

          // Determine credits to add based on product id
          const creditsToAdd = this.mapProductToCredits(productId || '');
          if (creditsToAdd > 0) {
            await this.creditsService.addCredits(
              user.id,
              creditsToAdd,
              `Purchased ${creditsToAdd} credits via Stripe Checkout`,
              CreditTransactionTypeEnum.PURCHASE
            );
          }

          // Update the provisional transaction
          const pending = await this.transactionsRepo.findOne({ where: { stripeSessionId: session.id, userId: user.id } });
          if (pending) {
            pending.amount = creditsToAdd;
            pending.balanceAfter = (await this.creditsService.getUserCredits(user.id)).balance;
            pending.stripePaymentIntentId = session.payment_intent as string | null;
            pending.stripeInvoiceId = session.invoice as string | null;
            pending.stripePriceId = priceId || null;
            pending.stripeProductId = productId || null;
            pending.metadata = { ...(pending.metadata || {}), stage: 'completed' };
            await this.transactionsRepo.save(pending);
          }
        }
        break;
      }
      case 'charge.refunded':
      case 'charge.refund.updated': {
        // When a charge is refunded, revoke credits if we can locate the original transaction
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string | undefined;
        if (!paymentIntentId) break;
        const txn = await this.transactionsRepo.findOne({ where: { stripePaymentIntentId: paymentIntentId } });
        if (!txn) break;
        const user = await this.usersRepo.findOne({ where: { id: txn.userId } });
        if (!user) break;
        const amountToRevoke = Math.max(0, txn.amount);
        if (amountToRevoke > 0) {
          await this.creditsService.revokeCredits(user.id, amountToRevoke, 'Credits revoked due to refund', CreditTransactionTypeEnum.REFUND);
        }
        break;
      }
      default:
        break;
    }
  }
}


