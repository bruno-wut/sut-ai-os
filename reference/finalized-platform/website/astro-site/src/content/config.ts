import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const cloudflareImageUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).hostname === "imagedelivery.net", {
    message: "coverImage must be a Cloudflare Images delivery URL from imagedelivery.net"
  });

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string().min(1),
    publishDate: z.coerce.date(),
    excerpt: z.string().min(1),
    coverImage: cloudflareImageUrl,
    author: z.string().min(1),
    tags: z.array(z.string().min(1))
  })
});

const publicImagePath = z
  .string()
  .regex(/^\/images\/.+\.(?:avif|gif|jpe?g|png|svg|webp)$/i, {
    message: "localFallback must be a public /images/... asset path"
  });

const cloudflareImageId = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, {
    message: "imageId must be a safe Cloudflare Images or R2 object key"
  });

const r2ObjectKey = z
  .string()
  .regex(/^library\/images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/, {
    message: "r2ObjectKey must be under library/images/"
  });

const imageLibraryEntry = z
  .object({
    key: z.string().min(1),
    title: z.string().min(1),
    altText: z.string().min(1),
    cloudflareId: cloudflareImageId.optional(),
    r2ObjectKey: r2ObjectKey.optional(),
    deliveryUrl: cloudflareImageUrl.optional(),
    localFallback: publicImagePath.optional()
  })
  .refine((value) => value.r2ObjectKey || value.cloudflareId || value.deliveryUrl || value.localFallback, {
    message: "Each image entry needs r2ObjectKey, cloudflareId, deliveryUrl, or localFallback"
  });

const imageReference = z.string().min(1);

const imageLibrary = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/images" }),
  schema: z.object({
    images: z.array(imageLibraryEntry)
  })
});

const homeCard = z.object({
  image: imageReference,
  alt: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  href: z.string().min(1),
  cta: z.string().min(1)
});

const eventSlide = z.object({
  image: imageReference,
  alt: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1)
});

const room = z.object({
  title: z.string().min(1),
  image: imageReference,
  alt: z.string().min(1),
  text: z.string().min(1),
  features: z.array(z.string().min(1)).min(1)
});

const roomSeries = z.object({
  id: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  rooms: z.array(room).min(1)
});

const venue = z.object({
  title: z.string().min(1),
  image: imageReference,
  alt: z.string().min(1),
  eyebrow: z.string().min(1),
  capacity: z.string().min(1),
  text: z.string().min(1),
  href: z.string().min(1),
  featured: z.boolean().optional()
});

const locationHighlight = z.object({
  title: z.string().min(1),
  image: imageReference,
  alt: z.string().min(1),
  text: z.string().min(1)
});

const pageMedia = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/page-media" }),
  schema: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("home"),
      heroImage: imageReference,
      overviewImage: imageReference,
      roomCards: z.array(homeCard).min(1),
      diningImage: imageReference,
      eventSlides: z.array(eventSlide).min(1)
    }),
    z.object({
      kind: z.literal("rooms"),
      heroImage: imageReference,
      roomSeries: z.array(roomSeries).min(1)
    }),
    z.object({
      kind: z.literal("dining"),
      heroImage: imageReference,
      overviewCards: z.array(homeCard).min(1)
    }),
    z.object({
      kind: z.literal("meetings-events"),
      heroImage: imageReference,
      overviewCards: z.array(homeCard).min(1),
      venues: z.array(venue).min(1)
    }),
    z.object({
      kind: z.literal("location"),
      heroImage: imageReference,
      highlights: z.array(locationHighlight).min(1)
    }),
    z.object({
      kind: z.literal("contact"),
      heroImage: imageReference
    })
  ])
});

const gallerySlide = z.object({
  image: imageReference,
  label: z.string().min(1)
});

const galleryItem = z.object({
  label: z.string().min(1),
  slides: z.array(gallerySlide).min(1)
});

const galleries = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/galleries" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    heroImage: imageReference,
    heroAlt: z.string().min(1),
    heroText: z.string(),
    groups: z.array(
      z.object({
        title: z.string().min(1),
        items: z.array(galleryItem).min(1)
      })
    ).min(1)
  })
});

export const collections = { news, imageLibrary, pageMedia, galleries };
