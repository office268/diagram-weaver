// ============================================================
// src/lib/payments/paddle.ts
// ספריית עזר (lib) — paddle.ts
// ============================================================
import { resolvePaddlePrice, createPortalSession } from "@/lib/payments/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;

export async function initializePaddle() {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      const paddleJsEnvironment =
        getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(paddleJsEnvironment);
      window.Paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  return resolvePaddlePrice({ data: { priceId, environment } });
}

export async function openCheckout(opts: {
  priceId: string;
  userId: string;
  email?: string;
  successUrl?: string;
}) {
  await initializePaddle();
  const paddlePriceId = await getPaddlePriceId(opts.priceId);
  window.Paddle.Checkout.open({
    items: [{ priceId: paddlePriceId, quantity: 1 }],
    customer: opts.email ? { email: opts.email } : undefined,
    customData: { userId: opts.userId },
    settings: {
      displayMode: "overlay",
      successUrl:
        opts.successUrl || `${window.location.origin}/billing?checkout=success`,
      allowLogout: false,
      variant: "one-page",
    },
  });
}

export async function openCustomerPortal() {
  const environment = getPaddleEnvironment();
  const { url } = await createPortalSession({ data: { environment } });
  window.open(url, "_blank");
}
