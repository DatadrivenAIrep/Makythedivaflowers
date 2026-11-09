import "server-only";

// Client for the external loyalty-card API (see the program's public/api.md).

export type LoyaltyCustomer = {
  id: number;
  cardUrl: string;
  rewards: { available: { id: string; reward: string; final: boolean }[] };
};

type CallOpts = { timeoutMs: number };

export class LoyaltyApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = "LoyaltyApiError";
    this.code = code;
    this.status = status;
  }
}

export function loyaltyEnabled(): boolean {
  return Boolean(process.env.LOYALTY_API_URL && process.env.LOYALTY_API_KEY);
}

async function call<T>(method: "GET" | "POST", path: string, body: unknown, opts: CallOpts): Promise<T> {
  const base = process.env.LOYALTY_API_URL;
  const key = process.env.LOYALTY_API_KEY;
  if (!base || !key) throw new LoyaltyApiError("unavailable", 0, "loyalty_not_configured");

  let res: Response;
  let data: unknown;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
      cache: "no-store",
    });
    data = await res.json();
  } catch {
    // Timeout, network failure or a body that is not JSON.
    throw new LoyaltyApiError("unavailable", 0);
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: unknown; message?: unknown } } | null)?.error;
    const code = typeof err?.code === "string" ? err.code : "unavailable";
    const message = typeof err?.message === "string" ? err.message : undefined;
    throw new LoyaltyApiError(code, res.status, message);
  }
  return data as T;
}

/**
 * A 200 is only trusted once it looks like a customer. Anything else counts as
 * the program being down, so checkout carries on and a stamp stays pending; only
 * a 404 customer_not_found means "no card".
 */
function parseCustomer(value: unknown): LoyaltyCustomer {
  const c = value as Partial<LoyaltyCustomer> | null | undefined;
  const available = c?.rewards?.available;
  const valid =
    typeof c === "object" &&
    c !== null &&
    typeof c.id === "number" &&
    Array.isArray(available) &&
    available.every((r) => typeof r?.id === "string" && typeof r?.reward === "string");
  if (!valid) throw new LoyaltyApiError("unavailable", 0);
  return c as LoyaltyCustomer;
}

export async function lookupCustomer(phone: string, opts: CallOpts): Promise<LoyaltyCustomer | null> {
  try {
    const r = await call<{ customer?: unknown } | null>("POST", "/customers/lookup", { phone }, opts);
    return parseCustomer(r?.customer);
  } catch (e) {
    if (e instanceof LoyaltyApiError && e.code === "customer_not_found") return null;
    throw e;
  }
}

export async function createCustomer(
  input: { name: string; phone: string },
  opts: CallOpts,
): Promise<{ customer: LoyaltyCustomer; existing: boolean }> {
  const r = await call<{ customer?: unknown; existing?: boolean } | null>(
    "POST",
    "/customers",
    { name: input.name, phone: input.phone, consent: true },
    opts,
  );
  return { customer: parseCustomer(r?.customer), existing: Boolean(r?.existing) };
}

export async function redeemReward(
  customerId: number,
  rewardId: string,
  orderId: string,
  opts: CallOpts,
): Promise<void> {
  await call(
    "POST",
    `/customers/${customerId}/rewards/${encodeURIComponent(rewardId)}/redeem`,
    { orderId },
    opts,
  );
}

export async function addStamp(customerId: number, orderId: string, opts: CallOpts): Promise<void> {
  await call("POST", `/customers/${customerId}/stamps`, { orderId, count: 1 }, opts);
}

export async function reverseOrder(
  orderId: string,
  opts: CallOpts,
): Promise<{ rewardsAlreadyUsed: { reward: string }[] }> {
  const r = await call<{ rewardsAlreadyUsed?: { reward: string }[] }>(
    "POST",
    `/orders/${encodeURIComponent(orderId)}/reverse`,
    {},
    opts,
  );
  return { rewardsAlreadyUsed: r.rewardsAlreadyUsed ?? [] };
}
