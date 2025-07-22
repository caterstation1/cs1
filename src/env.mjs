import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SHOPIFY_SHOP_URL: z.string(),
    SHOPIFY_ACCESS_TOKEN: z.string(),
    SHOPIFY_API_VERSION: z.string(),
    SHOPIFY_API_SECRET: z.string(),
    SHOPIFY_LOCATION_ID: z.string(),
    // Clicksend SMS Configuration
    CLICKSEND_USERNAME: z.string(),
    CLICKSEND_API_KEY: z.string(),
    CLICKSEND_SENDER_ID: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: z.string(),
    NEXT_PUBLIC_SHOPIFY_STORE_URL: z.string(),
  },
  runtimeEnv: {
    SHOPIFY_SHOP_URL: process.env.SHOPIFY_SHOP_URL,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_LOCATION_ID: process.env.SHOPIFY_LOCATION_ID,
    CLICKSEND_USERNAME: process.env.CLICKSEND_USERNAME,
    CLICKSEND_API_KEY: process.env.CLICKSEND_API_KEY,
    CLICKSEND_SENDER_ID: process.env.CLICKSEND_SENDER_ID,
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
    NEXT_PUBLIC_SHOPIFY_STORE_URL: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
  },
}); 