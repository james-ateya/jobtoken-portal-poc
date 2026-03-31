export type TokenPack = { kes: number; tokens: number };

export function getTokenPacks(): TokenPack[] {
  const raw = process.env.TOKEN_PACKS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (p): p is TokenPack =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as TokenPack).kes === "number" &&
            typeof (p as TokenPack).tokens === "number"
        );
      }
    } catch {
      /* use defaults */
    }
  }
  return [
    { kes: 100, tokens: 5 },
    { kes: 200, tokens: 12 },
    { kes: 500, tokens: 35 },
  ];
}

export function findPackByKes(kes: number): TokenPack | undefined {
  return getTokenPacks().find((p) => p.kes === kes);
}

export function normalizeKenyaPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return "254" + digits.slice(1);
  if (digits.length === 9) return "254" + digits;
  return digits;
}

function mpesaBaseUrl(): string {
  return (
    process.env.MPESA_BASE_URL ||
    (process.env.MPESA_ENV === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke")
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) {
    throw new Error("MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET are required");
  }
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(
    `${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`M-Pesa OAuth failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: string;
  };
  const expiresIn = parseInt(data.expires_in || "3599", 10) * 1000;
  cachedToken = {
    value: data.access_token,
    expiresAt: now + expiresIn,
  };
  return data.access_token;
}

function formatTimestamp(d = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function buildPassword(shortcode: string, passkey: string, timestamp: string): string {
  const str = shortcode + passkey + timestamp;
  return Buffer.from(str).toString("base64");
}

export type StkInitResult = {
  checkoutRequestId: string;
  responseCode: string;
  customerMessage?: string;
  merchantRequestId?: string;
};

function envTrim(key: string): string | undefined {
  const v = process.env[key];
  if (v == null) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export async function initiateStkPush(params: {
  amountKes: number;
  phone254: string;
  accountReference: string;
  transactionDesc: string;
}): Promise<StkInitResult> {
  const shortcode = envTrim("MPESA_SHORTCODE");
  const passkey = envTrim("MPESA_PASSKEY");
  const callbackUrl = envTrim("MPESA_CALLBACK_URL");
  const missing: string[] = [];
  if (!shortcode) missing.push("MPESA_SHORTCODE");
  if (!passkey) missing.push("MPESA_PASSKEY");
  if (!callbackUrl) missing.push("MPESA_CALLBACK_URL");
  if (missing.length) {
    throw new Error(
      `M-Pesa STK Push: set these in .env (non-empty values): ${missing.join(", ")}. ` +
        `Safaricom must reach your callback on the public internet — use ngrok/cloudflared to ` +
        `https://YOUR_TUNNEL/api/mpesa/callback for local dev, or deploy to Vercel and use that URL. ` +
        `For wallet testing without Daraja, set MPESA_SIMULATE=true and use the dev simulate top-up.`
    );
  }
  const txType =
    process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline";
  const timestamp = formatTimestamp();
  const password = buildPassword(shortcode, passkey, timestamp);
  const token = await getAccessToken();

  const body = {
    BusinessShortCode: parseInt(shortcode, 10),
    Password: password,
    Timestamp: timestamp,
    TransactionType: txType,
    Amount: Math.round(params.amountKes),
    PartyA: params.phone254,
    PartyB: parseInt(shortcode, 10),
    PhoneNumber: params.phone254,
    CallBackURL: callbackUrl,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.transactionDesc.slice(0, 13),
  };

  const res = await fetch(
    `${mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const json = (await res.json()) as {
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
    CustomerMessage?: string;
    errorMessage?: string;
  };

  if (!res.ok || json.ResponseCode !== "0") {
    const msg =
      json.ResponseDescription ||
      json.errorMessage ||
      `STK Push failed (${res.status})`;
    throw new Error(msg);
  }

  if (!json.CheckoutRequestID) {
    throw new Error("M-Pesa did not return CheckoutRequestID");
  }

  return {
    checkoutRequestId: json.CheckoutRequestID,
    responseCode: json.ResponseCode || "0",
    customerMessage: json.CustomerMessage,
    merchantRequestId: json.MerchantRequestID,
  };
}

export type StkCallbackParsed = {
  resultCode: number;
  resultDesc: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  amountKes: number | null;
  mpesaReceiptNumber: string | null;
  phone: string | null;
};

export function parseStkCallbackBody(body: unknown): StkCallbackParsed | null {
  const b = body as {
    Body?: {
      stkCallback?: {
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResultCode?: number;
        ResultDesc?: string;
        CallbackMetadata?: {
          Item?: Array<{ Name?: string; Value?: string | number }>;
        };
      };
    };
  };
  const cb = b?.Body?.stkCallback;
  if (!cb) return null;

  const items = cb.CallbackMetadata?.Item || [];
  const getVal = (name: string) => {
    const it = items.find((i) => i.Name === name);
    return it?.Value !== undefined && it?.Value !== null
      ? String(it.Value)
      : null;
  };

  const amountRaw = getVal("Amount");
  const amountKes = amountRaw ? parseFloat(amountRaw) : null;

  return {
    resultCode: typeof cb.ResultCode === "number" ? cb.ResultCode : -1,
    resultDesc: cb.ResultDesc || "",
    checkoutRequestId: cb.CheckoutRequestID || "",
    merchantRequestId: cb.MerchantRequestID || "",
    amountKes: Number.isFinite(amountKes) ? amountKes : null,
    mpesaReceiptNumber: getVal("MpesaReceiptNumber"),
    phone: getVal("PhoneNumber"),
  };
}
