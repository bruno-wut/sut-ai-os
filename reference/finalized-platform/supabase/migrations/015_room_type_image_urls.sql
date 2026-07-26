alter table public.room_types
  add column if not exists image_url text not null default '/images/grand-superior-room.jpg';

alter table public.room_types
  drop constraint if exists room_types_image_url_not_blank,
  drop constraint if exists room_types_image_url_format;

alter table public.room_types
  add constraint room_types_image_url_not_blank check (btrim(image_url) <> ''),
  add constraint room_types_image_url_format check (
    image_url ~ '^/images/[A-Za-z0-9._/-]+$'
    or image_url ~ '^https://imagedelivery[.]net/[^[:space:]]+$'
  );

comment on column public.room_types.image_url is
  'Guest-facing room type image. Accepts local /images paths or Cloudflare Images delivery URLs.';
