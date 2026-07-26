const en = {
  header: {
    skip: "Skip to main content", menu: "Menu", openMenu: "Open navigation menu", closeMenu: "Close navigation menu",
    contact: "Contact Us", reserve: "Reserve", quickActions: "Quick hotel actions", siteMenu: "Site menu",
    mainPages: "Main pages", call: "Call Hotel", email: "Email Hotel",
    enquire: "Book / Enquire", hotel: "Hotel", reserveStay: "Reserve your stay",
    closeReserve: "Close reservation panel", language: "ไทย", languageLabel: "เปลี่ยนภาษาเป็นภาษาไทย",
    manageReservation: "Manage My Reservation", existingBooking: "Already have a booking?"
  },
  nav: [
    ["/", "Hotel Overview"], ["/rooms/", "Rooms"], ["/dining/", "Dining"],
    ["/meetings-events/", "Meetings & Events"], ["/gallery/", "Gallery"],
    ["/location/", "Location"], ["/news/", "News"], ["/contact/", "Contact"]
  ],
  footer: {
    location: "Suphanburi, Thailand",
    description: "An established hotel in the heart of Suphanburi, trusted for comfortable stays, practical service, and convenient access to the city.",
    quickLinks: "Quick Links", legal: "Legal & Policies", contact: "Contact",
    privacy: "PDPA Privacy Policy", cancellation: "Cancellation & Refund Terms", terms: "Booking Terms",
    line: "LINE: Official account coming soon", copyright: "This website is prepared for Sri U-Thong Grand Hotel only."
  },
  booking: {
    enquiry: "Booking enquiry", dates: "Dates", chooseStay: "Choose your stay",
    selectDates: "Select check-in and check-out", guests: "Guests", guestSummary: "1 room | 2 adults",
    codes: "Special Codes", addCode: "Add special code", reserve: "Reserve"
  }
};

const th = {
  header: {
    skip: "ข้ามไปยังเนื้อหาหลัก", menu: "เมนู", openMenu: "เปิดเมนูนำทาง", closeMenu: "ปิดเมนูนำทาง",
    contact: "ติดต่อเรา", reserve: "จองห้องพัก", quickActions: "ทางลัดสำหรับติดต่อโรงแรม",
    siteMenu: "เมนูเว็บไซต์", mainPages: "หน้าหลัก", call: "โทรหาโรงแรม",
    email: "อีเมลโรงแรม", enquire: "จอง / สอบถาม", hotel: "โรงแรม",
    reserveStay: "จองห้องพักของคุณ", closeReserve: "ปิดหน้าต่างจองห้องพัก",
    language: "English", languageLabel: "Switch language to English",
    manageReservation: "ค้นหาประวัติการจอง", existingBooking: "มีรายการจองแล้ว?"
  },
  nav: [
    ["/", "ภาพรวมโรงแรม"], ["/rooms/", "ห้องพัก"], ["/dining/", "ห้องอาหาร"],
    ["/meetings-events/", "ประชุมและจัดเลี้ยง"], ["/gallery/", "แกลเลอรี"],
    ["/location/", "ที่ตั้ง"], ["/news/", "ข่าวสาร"], ["/contact/", "ติดต่อ"]
  ],
  footer: {
    location: "สุพรรณบุรี ประเทศไทย",
    description: "โรงแรมที่อยู่คู่เมืองสุพรรณบุรี ให้บริการห้องพักสะดวกสบาย การดูแลอย่างอบอุ่น และเดินทางเข้าเมืองได้สะดวก",
    quickLinks: "ลิงก์ด่วน", legal: "ข้อกำหนดและนโยบาย", contact: "ติดต่อ",
    privacy: "นโยบายความเป็นส่วนตัว PDPA", cancellation: "เงื่อนไขการยกเลิกและคืนเงิน", terms: "เงื่อนไขการจอง",
    line: "LINE: อยู่ระหว่างยืนยันบัญชีทางการ", copyright: "เว็บไซต์นี้จัดทำสำหรับโรงแรมศรีอู่ทองแกรนด์เท่านั้น"
  },
  booking: {
    enquiry: "สอบถามและจองห้องพัก", dates: "วันเข้าพัก", chooseStay: "เลือกวันเข้าพัก",
    selectDates: "เลือกวันเช็กอินและเช็กเอาต์", guests: "ผู้เข้าพัก", guestSummary: "1 ห้อง | ผู้ใหญ่ 2 ท่าน",
    codes: "รหัสพิเศษ", addCode: "เพิ่มรหัสพิเศษ", reserve: "จองห้องพัก"
  }
};

export const dictionaries = { en, th };
export const getDictionary = (locale) => dictionaries[locale] ?? dictionaries.en;
