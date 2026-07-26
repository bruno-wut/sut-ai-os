-- Replace the column-addition defaults on legacy room rows with the hotel room
-- catalog values. Rows already edited away from the generic default are untouched.

update public.room_types rt
set
  gallery_image_urls = jsonb_build_array(rt.image_url),
  room_size_sqm = case
    when rt.name like 'Classic Room%' then 28
    when rt.name = 'Deluxe Room' then 34
    when rt.name = 'Studio Suite' then 48
    when rt.name like 'Executive Room%' then 34
    when rt.name = 'Executive Suite' then 48
    when rt.name = 'Grand Residence' then 68
    else rt.room_size_sqm
  end,
  max_adults = case
    when rt.name in ('Deluxe Room', 'Grand Residence') then 3
    else 2
  end,
  bed_configuration = case
    when rt.name like 'Classic Room%' then 'One double bed or two single beds'
    when rt.name = 'Deluxe Room' then 'One double bed and one single bed'
    when rt.name = 'Studio Suite' then 'One double bed'
    when rt.name like 'Executive Room%' then 'One double bed or two single beds'
    when rt.name = 'Executive Suite' then 'One double bed'
    when rt.name = 'Grand Residence' then 'One king bed'
    else rt.bed_configuration
  end,
  bed_configuration_th = case
    when rt.name like 'Classic Room%' then 'เตียงใหญ่ 1 เตียง หรือเตียงเดี่ยว 2 เตียง'
    when rt.name = 'Deluxe Room' then 'เตียงใหญ่ 1 เตียง และเตียงเดี่ยว 1 เตียง'
    when rt.name = 'Studio Suite' then 'เตียงใหญ่ 1 เตียง'
    when rt.name like 'Executive Room%' then 'เตียงใหญ่ 1 เตียง หรือเตียงเดี่ยว 2 เตียง'
    when rt.name = 'Executive Suite' then 'เตียงใหญ่ 1 เตียง'
    when rt.name = 'Grand Residence' then 'เตียงคิงไซส์ 1 เตียง'
    else rt.bed_configuration_th
  end,
  extra_bed_policy = case
    when rt.name in ('Deluxe Room', 'Studio Suite', 'Executive Suite') then 'on-request'
    when rt.name = 'Grand Residence' then 'available'
    else 'not-available'
  end,
  full_description = case
    when rt.name like 'Classic Room%' then 'A warm, restful room with thoughtful essentials for business visits, city breaks, and comfortable overnight stays in Suphanburi.'
    when rt.name = 'Deluxe Room' then 'A generous room designed for guests who appreciate added space, natural light, and an easy place to unwind together.'
    when rt.name = 'Studio Suite' then 'A residential-style suite with distinct sleeping and sitting areas, ideal for longer stays or a quieter pace.'
    when rt.name like 'Executive Room%' then 'A composed sixth-floor retreat with refined finishes, comfortable work space, and a calm sense of privacy.'
    when rt.name = 'Executive Suite' then 'A polished two-room suite with a private bedroom and separate living salon for meetings, hosting, or unhurried evenings.'
    when rt.name = 'Grand Residence' then 'The hotel’s most spacious residence, pairing a private bedroom with a formal lounge for distinguished long stays and special visits.'
    else rt.full_description
  end,
  full_description_th = case
    when rt.name like 'Classic Room%' then 'ห้องพักบรรยากาศอบอุ่น พร้อมสิ่งอำนวยความสะดวกที่คัดสรรสำหรับการเดินทางเพื่อธุรกิจ การพักผ่อนในเมือง และการค้างคืนอย่างสบายในสุพรรณบุรี'
    when rt.name = 'Deluxe Room' then 'ห้องพักกว้างขวางสำหรับผู้ที่ชื่นชอบพื้นที่เพิ่มเติม แสงธรรมชาติ และมุมพักผ่อนร่วมกันอย่างสบาย'
    when rt.name = 'Studio Suite' then 'ห้องสวีทสไตล์เรสซิเดนซ์ แบ่งพื้นที่นอนและพื้นที่นั่งเล่นอย่างเป็นสัดส่วน เหมาะสำหรับการพักระยะยาวหรือการพักผ่อนอย่างเป็นส่วนตัว'
    when rt.name like 'Executive Room%' then 'ห้องพักบนชั้น 6 ที่โดดเด่นด้วยงานตกแต่งประณีต พื้นที่ทำงานที่สะดวก และบรรยากาศเงียบสงบเป็นส่วนตัว'
    when rt.name = 'Executive Suite' then 'ห้องสวีทสองห้องที่หรูหรา พร้อมห้องนอนส่วนตัวและห้องนั่งเล่นแยกเป็นสัดส่วน เหมาะสำหรับการประชุม รับรองแขก หรือพักผ่อนยามค่ำคืน'
    when rt.name = 'Grand Residence' then 'ห้องพักที่กว้างขวางที่สุดของโรงแรม ประกอบด้วยห้องนอนส่วนตัวและห้องรับรอง เหมาะสำหรับการพักระยะยาวและโอกาสพิเศษ'
    else rt.full_description_th
  end,
  amenities = array[
    'air-conditioning', 'breakfast', 'city-view', 'daily-housekeeping',
    'desk', 'electric-kettle', 'hair-dryer', 'in-room-wifi',
    'non-smoking', 'private-bathroom', 'refrigerator', 'television',
    'toiletries', 'wardrobe'
  ]::text[],
  updated_at = now()
where rt.is_active
  and rt.full_description = 'A comfortable guest room with the hotel essentials for a restful stay.'
  and (
    rt.name like 'Classic Room%'
    or rt.name = 'Deluxe Room'
    or rt.name = 'Studio Suite'
    or rt.name like 'Executive Room%'
    or rt.name = 'Executive Suite'
    or rt.name = 'Grand Residence'
  );
