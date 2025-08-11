import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SHOPIFY_SHOP_URL: z.string(),
    SHOPIFY_ACCESS_TOKEN: z.string(),
    SHOPIFY_API_VERSION: z.string(),
    SHOPIFY_API_SECRET: z.string(),
    SHOPIFY_LOCATION_ID: z.string(),
    // Cloudinary (server-side operations like destroy)
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    // Clicksend SMS Configuration
    CLICKSEND_USERNAME: z.string(),
    CLICKSEND_API_KEY: z.string(),
    CLICKSEND_SENDER_ID: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: z.string(),
    NEXT_PUBLIC_SHOPIFY_STORE_URL: z.string(),
    // Cloudinary client-side unsigned upload
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
    NEXT_PUBLIC_CLOUDINARY_BASE_FOLDER: z.string().optional(),
  },
  runtimeEnv: {
    SHOPIFY_SHOP_URL: process.env.SHOPIFY_SHOP_URL,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_LOCATION_ID: process.env.SHOPIFY_LOCATION_ID,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLICKSEND_USERNAME: process.env.CLICKSEND_USERNAME,
    CLICKSEND_API_KEY: process.env.CLICKSEND_API_KEY,
    CLICKSEND_SENDER_ID: process.env.CLICKSEND_SENDER_ID,
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
    NEXT_PUBLIC_SHOPIFY_STORE_URL: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    NEXT_PUBLIC_CLOUDINARY_BASE_FOLDER: process.env.NEXT_PUBLIC_CLOUDINARY_BASE_FOLDER,
  },
}); 