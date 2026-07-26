-- Restore the intended category covers for legacy inventory initialized before
-- room-specific R2 images were persisted. Preserve non-preset gallery additions.

with intended as (
  select
    rt.id,
    case
      when rt.name like 'Classic Room%' then 'https://assets.sriuthonghotels.com/library/images/grand-superior-room.jpg'
      when rt.name = 'Deluxe Room' or rt.name like 'Executive Room%' then 'https://assets.sriuthonghotels.com/library/images/grand-deluxe-room.jpg'
      when rt.name in ('Studio Suite', 'Executive Suite', 'Grand Residence') then 'https://assets.sriuthonghotels.com/library/images/grand-suite-room.jpg'
    end as cover_url
  from public.room_types rt
  where rt.is_active
    and (
      rt.image_url = '/images/grand-superior-room.jpg'
      or rt.image_url = 'https://assets.sriuthonghotels.com/library/images/grand-superior-room.jpg'
    )
    and (
      rt.name like 'Classic Room%'
      or rt.name = 'Deluxe Room'
      or rt.name like 'Executive Room%'
      or rt.name in ('Studio Suite', 'Executive Suite', 'Grand Residence')
    )
), corrected as (
  select
    intended.id,
    intended.cover_url,
    jsonb_build_array(intended.cover_url) || coalesce((
      select jsonb_agg(image.value order by image.ordinality)
      from public.room_types source
      cross join lateral jsonb_array_elements_text(source.gallery_image_urls)
        with ordinality as image(value, ordinality)
      where source.id = intended.id
        and image.value not in (
          '/images/grand-superior-room.jpg',
          'https://assets.sriuthonghotels.com/library/images/grand-superior-room.jpg',
          intended.cover_url
        )
    ), '[]'::jsonb) as gallery_image_urls
  from intended
)
update public.room_types rt
set
  image_url = corrected.cover_url,
  gallery_image_urls = corrected.gallery_image_urls,
  updated_at = now()
from corrected
where rt.id = corrected.id;
