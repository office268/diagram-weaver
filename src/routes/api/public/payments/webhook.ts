// ============================================================
// src/routes/api/public/payments/webhook.ts
// HTTP endpoint (server route) — webhook.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  verifyWebhook,
  EventName,
  type PaddleEnv,
} from "@/lib/payments/paddle.server";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

const MONTHLY_CREDITS = 125;
const PACK_CREDITS_100 = 100;
const PACK_CREDITS_250 = 250;

async function grantCredits(
  userId: string,
  amount: number,
  kind: string,
  description: string,
  eventId: string,
) {
  await getSupabase().rpc("grant_credits", {
    _user_id: userId,
    _amount: amount,
    _kind: kind,
    _description: description,
    _paddle_event_id: eventId,
  });
}

async function handleSubscriptionCreatedOrUpdated(
  data: any,
  env: PaddleEnv,
  eventId: string,
  isCreate: boolean,
) {
  const { id, customerId, items, status, currentBillingPeriod, customData, scheduledChange } = data;
  const userId = customData?.userId;
  if (!userId) {
    console.error("[webhook] No userId in customData");
    return;
  }

  const item = items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("[webhook] missing importMeta.externalId", {
      rawPriceId: item.price.id,
      rawProductId: item.product?.id,
    });
    return;
  }

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" },
  );

  // Grant monthly credits on creation; renewals come via transaction.completed billing_period
  if (isCreate && priceId === "monthly_subscription" && status !== "canceled") {
    await grantCredits(
      userId,
      MONTHLY_CREDITS,
      "subscription_grant",
      "הענקת קרדיטים חודשית",
      `sub_create_${id}`,
    );
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

async function handleTransactionCompleted(
  data: any,
  env: PaddleEnv,
  eventId: string,
) {
  const userId = data.customData?.userId;
  if (!userId) {
    console.error("[webhook] tx.completed missing userId");
    return;
  }
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  if (!priceId) {
    console.warn("[webhook] tx.completed missing price external_id");
    return;
  }

  if (priceId === "credits_100") {
    await grantCredits(
      userId,
      PACK_CREDITS_100,
      "purchase",
      "רכישת חבילת 100 קרדיטים",
      `tx_${data.id}`,
    );
  } else if (priceId === "credits_250") {
    await grantCredits(
      userId,
      PACK_CREDITS_250,
      "purchase",
      "רכישת חבילת 250 קרדיטים",
      `tx_${data.id}`,
    );
  } else if (priceId === "monthly_subscription" && data.origin === "subscription_recurring") {
    // Subscription renewal payment → grant monthly credits (idempotent by tx id)
    await grantCredits(
      userId,
      MONTHLY_CREDITS,
      "subscription_grant",
      "חידוש מנוי חודשי — הענקת קרדיטים",
      `tx_${data.id}`,
    );
  }
  void env;
  void eventId;
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event: any = await verifyWebhook(req, env);
  const eventId = event.eventId ?? event.notificationId ?? "";

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreatedOrUpdated(event.data, env, eventId, true);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionCreatedOrUpdated(event.data, env, eventId, false);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env, eventId);
      break;
    default:
      console.log("[webhook] unhandled:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
