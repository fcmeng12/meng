import "server-only";

type TushareScalar = string | number | boolean | null | undefined;

interface TushareResponse {
  code: number;
  msg: string | null;
  data?: {
    fields: string[];
    items: unknown[][];
  };
}

export type MarketDataErrorCode =
  | "TOKEN_MISSING"
  | "UPSTREAM_HTTP_ERROR"
  | "UPSTREAM_API_ERROR"
  | "UPSTREAM_INVALID_RESPONSE"
  | "UPSTREAM_TIMEOUT";

export class MarketDataError extends Error {
  constructor(public readonly code: MarketDataErrorCode, message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}

export function hasTushareToken() {
  return Boolean(process.env.TUSHARE_TOKEN?.trim());
}

export async function queryTushare<T>(
  apiName: string,
  params: Record<string, TushareScalar>,
  fields: string[],
): Promise<T[]> {
  const token = process.env.TUSHARE_TOKEN?.trim();
  if (!token) {
    throw new MarketDataError("TOKEN_MISSING", "未配置 TUSHARE_TOKEN");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch("https://api.tushare.pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_name: apiName,
        token,
        params,
        fields: fields.join(","),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new MarketDataError("UPSTREAM_HTTP_ERROR", `Tushare HTTP ${response.status}`);
    }

    const payload = await response.json() as TushareResponse;
    if (payload.code !== 0) {
      throw new MarketDataError("UPSTREAM_API_ERROR", payload.msg || `Tushare API ${payload.code}`);
    }
    if (!payload.data || !Array.isArray(payload.data.fields) || !Array.isArray(payload.data.items)) {
      throw new MarketDataError("UPSTREAM_INVALID_RESPONSE", "Tushare 返回结构不完整");
    }

    return payload.data.items.map((item) => Object.fromEntries(
      payload.data!.fields.map((field, index) => [field, item[index]]),
    ) as unknown as T);
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MarketDataError("UPSTREAM_TIMEOUT", "Tushare 请求超时");
    }
    throw new MarketDataError("UPSTREAM_HTTP_ERROR", "无法连接 Tushare 行情接口");
  } finally {
    clearTimeout(timeout);
  }
}
