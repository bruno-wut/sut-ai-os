import { astroSiteConfig } from "./siteConfig.js";

const sharedSite = astroSiteConfig;

const en = {
  site: {
    ...sharedSite,
    phoneShortLabel: "Tel",
    faxShortLabel: "Fax",
    localeDate: "en-GB",
    localeArticleDate: "en-US",
    brandHomeLabel: "Sri U-Thong Grand Hotel home",
    languageOptionsLabel: "Language options",
    sectionNavigationLabel: "On-page navigation",
    switchToThai: "Switch language to Thai",
    switchToEnglish: "Switch language to English",
    mapTitle: "Sri U-Thong Grand Hotel map",
    photoViewerLabel: "Hotel photo viewer",
    schemaAmenity: "Central Suphanburi location",
    locationShareTitle: "Suphanburi highlights near Sri U-Thong Grand Hotel",
    locationShareText: "Places to visit in Suphanburi, recommended by Sri U-Thong Grand Hotel."
  },
  bookingBar: {
    datesEyebrow: "Stay Dates",
    datesTitle: "Plan your stay",
    guestsEyebrow: "Guests",
    guestsTitle: "Who is coming?",
    codesEyebrow: "Special Code",
    codesTitle: "Promo or corporate code",
    backToReserveDetails: "Back to booking details",
    closeDateSelection: "Close date selection",
    closeGuestDetails: "Close guest details",
    closeSpecialCodes: "Close promo code",
    checkInLabel: "Check-in",
    checkOutLabel: "Check-out",
    selectDate: "Select date",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    calendarLabel: "Stay date calendar",
    datesNote: "Select your check-in date, then select a check-out date.",
    adultsLabel: "Adults",
    adultsNote: "Age 8 and above",
    childrenLabel: "Children",
    childrenNote: "Age 0 to 7",
    roomsLabel: "Rooms",
    roomsNote: "You can adjust this once you have chosen a room type",
    guestCountsNote: "Guest and room counts will be included when the IBE handoff is activated.",
    confirmGuests: "Confirm guests",
    codeLabel: "Promo or corporate code",
    codePlaceholder: "Enter code here",
    codeNote: "Leave blank if you do not have a code.",
    confirmCode: "Apply code",
    submitReady: "Booking details are ready. Connect PUBLIC_SUT_IBE_URL after test deployment to send guests directly to the booking engine.",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    client: {
      localeDate: "en-GB",
      chooseStay: "Choose your stay",
      selectDates: "Select check-in and check-out",
      defaultNight: "1 night",
      nightSingular: "night",
      nightPlural: "nights",
      staySuffix: "stay",
      previewSuffix: "preview",
      selectCheckout: "Select check-out",
      chooseCheckoutDate: "Choose check-out date",
      selectDate: "Select date",
      addCode: "Add a promo code",
      adultSingular: "adult",
      adultPlural: "adults",
      childSingular: "child",
      childPlural: "children",
      roomSingular: "room",
      roomPlural: "rooms",
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    }
  },
  latestNews: {
    readArticle: "Read More",
    viewAll: "View All Posts",
    emptyTitle: "Stories are being prepared.",
    emptyText: "Hotel news and Suphanburi travel guides will appear here once published.",
    articleLinkAria: (title) => `Read ${title}`,
    coverAlt: (title) => `${title} cover image`,
    tagsAria: "Article tags"
  },
  contactOptions: {
    call: "Call",
    email: "Email",
    line: "LINE",
    lineStatus: "Official account coming soon",
    lineAria: "LINE official account pending",
    agoda: "Agoda",
    agodaStatus: "View on Agoda",
    facebook: "Facebook",
    facebookStatus: "Visit our Facebook page"
  },
  roomCard: {
    amenitiesAria: (title) => `Amenities for ${title}`,
    photographyLabel: "View Photos",
    availabilityLabel: "Reserve This Room"
  },
  home: {
    meta: {
      title: "Suphanburi's Finest Hotel - Luxury Hotel Thailand | Sri U-Thong Grand Hotel",
      description: "Sri U-Thong Grand Hotel stands at the heart of Suphanburi — a refined retreat where thoughtful design and warm Thai hospitality welcome every guest."
    },
    hero: {
      eyebrow: "",
      title: "Discover the Heartbeat of Suphanburi",
      text: "",
      primaryLabel: "Reserve a Room",
      secondaryLabel: "Explore the Hotel"
    },
    sectionNav: {
      ariaLabel: "On-page navigation",
      items: [
        {
          id: "home-overview",
          label: "Overview"
        },
        {
          id: "home-rooms",
          label: "Rooms"
        },
        {
          id: "home-dining",
          label: "Dining"
        },
        {
          id: "home-events",
          label: "Events"
        },
        {
          id: "home-news",
          label: "Journal"
        },
        {
          id: "home-location",
          label: "Location"
        }
      ]
    },
    directBar: {
      locationLink: "View on Map"
    },
    overview: {
      eyebrow: "Suphanburi's Premier Hotel",
      title: "A refined sanctuary at the heart of the province.",
      lead: "Sri U-Thong Grand Hotel occupies the most sought-after address in central Suphanburi. Warm teak accents, plush furnishings, and attentive service create a restorative retreat — a calm, distinguished base from which to savour everything the city has to offer.",
      facts: [
        {
          strong: "Prime Location",
          text: "Steps from the city's cultural and commercial landmarks"
        },
        {
          strong: "2 km",
          text: "To the provincial hall"
        },
        {
          strong: "2 hours",
          text: "A scenic journey from Bangkok"
        }
      ]
    },
    rooms: {
      eyebrow: "Accommodations",
      title: "Rooms & Suites",
      lead: "Six distinctive room types across two celebrated series. Savour the warm heritage character of the Heritage Series, or elevate your stay with the newly renovated Premier Series on the sixth floor — where refined finishes await."
    },
    dining: {
      eyebrow: "Dining",
      title: "Culinary Destinations",
      lead: "Savour authentic Thai flavours crafted from local ingredients alongside international classics. From a sunlit morning spread to a relaxed evening in the restaurant, each meal is an occasion in its own right.",
      primaryLabel: "View Dining",
      secondaryLabel: "Private Arrangements"
    },
    events: {
      eyebrow: "Meetings & Events",
      title: "Where Occasions Come to Life",
      lead: "Three iconic venues accommodate everything from decisive boardroom meetings to timeless wedding celebrations. Our dedicated events team handles every detail — from layout and catering to lighting and flow — so your occasion unfolds without effort.",
      primaryLabel: "Plan an Event",
      slideshowLabel: "Meetings and events photography",
      controlsLabel: "Browse event photography",
      previousImage: "Previous photo",
      nextImage: "Next photo",
      showImage: (title) => `View ${title}`
    },
    news: {
      eyebrow: "Journal",
      title: "Stories from the City",
      text: "Curated travel insights, culinary highlights, and local Suphanburi guides — written for the curious guest."
    },
    location: {
      eyebrow: "Location",
      title: "At the Centre of It All",
      lead: "Step out from the hotel and find yourself within reach of Suphanburi's most celebrated temples, markets, and civic landmarks. Return to the calm of a well-appointed room, knowing the city is yours to explore at your own pace.",
      primaryLabel: "Explore Location",
      secondaryLabel: "Contact Concierge"
    }
  },
  rooms: {
    meta: {
      title: "Rooms & Suites | Sri U-Thong Grand Hotel",
      description: "Six distinguished room types at Sri U-Thong Grand Hotel — from sunlit Classic Rooms to the grand scale of the Grand Residence. Each space is designed for genuine rest and refined comfort."
    },
    sectionNav: [
      {
        id: "rooms-collection",
        label: "Overview"
      },
      {
        id: "premier-series",
        label: "Premier"
      },
      {
        id: "heritage-series",
        label: "Heritage"
      },
      {
        id: "rooms-cta",
        label: "Reserve"
      }
    ],
    hero: {
      title: "Rooms & Suites",
      text: "Six room types for every kind of stay. The newly renovated Premier Series on the sixth floor offers refined finishes. The Heritage Series delivers warm, authentic character and outstanding value.",
      primaryLabel: "Check Availability",
      secondaryLabel: "View Photography"
    },
    intro: {
      eyebrow: "The Collection",
      title: "Designed for Genuine Rest.",
      lead: "Each room at Sri U-Thong Grand is a considered retreat — sunlit interiors, plush bedding, and warm teak accents create a restorative environment that welcomes you back after a day spent exploring the city. From inviting standard comforts to the residential grandeur of our finest suite, every space is maintained to an uncompromising standard."
    },
    filter: {
      ariaLabel: "Filter by room series",
      prompt: "Browse",
      all: "All Rooms",
      premier: "Premier Series",
      heritage: "Heritage Series"
    },
    closing: {
      eyebrow: "Your Stay",
      title: "Find your ideal room.",
      text: "Select your dates and guest details to see what is available for your stay.",
      primaryLabel: "Check Availability",
      secondaryLabel: "Contact Reservations"
    },
    categories: {
      classic: {
        title: "Classic Room",
        statement: "A warm retreat for the modern traveller.",
        desc: "Blending inviting comforts with tasteful design, the Classic Room exudes the warmth of home with distinctive Thai touches. Fall asleep in a plush bed dressed in crisp, quality linen and wake refreshed — a serene haven after a full day in the city.",
        ideal: "Ideal for: Solo travellers and couples on a city stay.",
        features: ["Twin or double bed configuration", "Complimentary breakfast", "Maximum occupancy: 2 guests"]
      },
      deluxe: {
        title: "Deluxe Room",
        statement: "Generous space for shared moments.",
        desc: "The Deluxe Room offers an expansive footprint designed for families and small groups who want room to breathe. Natural light fills the space through wide windows, while a dedicated seating alcove invites relaxed conversation. Settle in, and let the city wait.",
        ideal: "Ideal for: Families and groups seeking shared comfort.",
        features: ["1 Double bed and 1 single bed", "Complimentary breakfast", "Maximum occupancy: 3 guests"]
      },
      studiosuite: {
        title: "Studio Suite",
        statement: "A residential feel for longer stays.",
        desc: "The Studio Suite separates sleeping and living with intention — a plush bedroom on one side, a comfortable lounge zone on the other. Savour the ease of having space to work, unwind, and simply be. A natural choice for those who prefer to travel slowly.",
        features: ["Double bed", "Complimentary breakfast", "Maximum occupancy: 2 guests"]
      },
      executive: {
        title: "Executive Room",
        statement: "Sixth floor. Refined finishes. Fully renewed.",
        desc: "Elevated on the newly renovated sixth floor, the Executive Room benefits from refined finishes and an atmosphere of quiet distinction — every detail curated to add ease and status to your stay.",
        features: ["Twin or double bed configuration", "Complimentary breakfast", "Maximum occupancy: 2 guests"]
      },
      execsuite: {
        title: "Executive Suite",
        statement: "Distinct living and sleeping — on the sixth floor.",
        desc: "The Executive Suite offers the privacy of a true two-room arrangement. A richly appointed living salon adjoins the sleeping quarters, providing a composed setting for an in-room meeting or an evening of undisturbed relaxation. Reserved for guests who value space as much as comfort.",
        features: ["Double bed", "Complimentary breakfast", "Maximum occupancy: 2 guests"]
      },
      grandres: {
        title: "Grand Residence",
        statement: "The pinnacle of the hotel — prestige and scale.",
        desc: "Sri U-Thong Grand's most distinguished offering. The Grand Residence unfolds across grand proportions, with a formal sitting room, generous entertaining areas, and custom furnishings. Designed for those who wish to host, celebrate, or simply inhabit a space worthy of their status.",
        features: ["King bed", "Complimentary breakfast", "Maximum occupancy: 3 guests"]
      }
    }
  },
  dining: {
    meta: {
      title: "Dining | Sri U-Thong Grand Hotel",
      description: "Savour authentic Thai cuisine and international dishes at Sri U-Thong Grand Hotel. Daily breakfast, casual dining, and private group arrangements in the heart of Suphanburi."
    },
    sectionNav: [
      {
        id: "dining-overview",
        label: "Overview"
      },
      {
        id: "dining-enquiries",
        label: "Enquiries"
      }
    ],
    hero: {
      title: "Culinary Destinations",
      text: "Authentic flavours, local ingredients, and a warm, unhurried atmosphere — from the first coffee of the morning to the last course of the evening.",
      primaryLabel: "Dining Enquiries",
      secondaryLabel: "Contact the Hotel"
    },
    overview: {
      eyebrow: "The Restaurant",
      title: "Every meal, an occasion.",
      lead: "The hotel restaurant is a calm, sunlit space that transforms from a vibrant breakfast spread in the morning to a relaxed dining venue through the day. Every dish draws on the finest local produce and the authentic techniques of Thai regional cooking, with international selections alongside."
    },
    overviewCards: [
      {
        slug: "morning",
        eyebrow: "Breakfast",
        title: "The Morning Ritual",
        text: "Awaken to a curated spread of continental classics and authentic local delicacies. Sunlit interiors, freshly brewed coffee, and warm, intuitive service — a restorative start that sets the tone for the day ahead.",
        cta: "Ask About Breakfast"
      },
      {
        slug: "evening",
        eyebrow: "All-Day Dining",
        title: "Savour the Day",
        text: "The restaurant serves lunch and dinner in a relaxed, welcoming atmosphere. Thai staples crafted from local produce sit alongside international favourites — a menu that rewards lingering.",
        cta: "Contact the Team"
      },
      {
        slug: "groups",
        eyebrow: "Private & Groups",
        title: "Private Dining & Group Meals",
        text: "For family celebrations, corporate luncheons, or intimate private dining, our team arranges dedicated spaces and tailored menus with care and attention to every detail.",
        cta: "Arrange a Private Meal"
      }
    ],
    enquiries: {
      eyebrow: "Dining Enquiries",
      title: "Let us arrange it for you.",
      lead: "For group bookings, private dining, or event catering enquiries, contact our team and we will take care of every detail.",
      primaryLabel: "Contact the Hotel",
      secondaryLabel: "Call Now"
    }
  },
  meetingsEvents: {
    meta: {
      title: "Meetings & Events | Sri U-Thong Grand Hotel",
      description: "Distinguished venues for corporate meetings, seminars, gala dinners, and bespoke weddings at Sri U-Thong Grand Hotel in Suphanburi."
    },
    sectionNav: [
      {
        id: "events-overview",
        label: "Overview"
      },
      {
        id: "venues",
        label: "Venues"
      },
      {
        id: "events-cta",
        label: "Enquire"
      }
    ],
    hero: {
      title: "Where Occasions Come to Life",
      text: "Three distinguished venues for corporate meetings, landmark celebrations, and timeless weddings — all delivered with seamless, personalised service.",
      primaryLabel: "Plan an Event",
      secondaryLabel: "Talk to Our Team"
    },
    overview: {
      eyebrow: "Event Spaces",
      title: "Flawless execution in a distinguished setting.",
      lead: "From decisive executive summits to emotionally resonant wedding days, Sri U-Thong Grand Hotel provides a versatile canvas of grand architecture and modern technology. Our dedicated events team ensures every detail — setup, catering, timing, and flow — is handled with absolute precision."
    },
    overviewCards: [
      {
        slug: "meetings",
        eyebrow: "Corporate",
        title: "Meetings & Conferences",
        text: "State-of-the-art environments for team meetings, corporate training, seminars, and executive briefings. Full audiovisual infrastructure and dedicated support throughout.",
        cta: "Enquire Now"
      },
      {
        slug: "celebrations",
        eyebrow: "Weddings",
        title: "A Love Before Time",
        text: "Where timeless romance meets bespoke celebration. Our wedding specialists orchestrate every element — from the floral arrangements to the final dance — so you can be fully present for every moment.",
        cta: "Plan Your Wedding"
      },
      {
        slug: "groups",
        eyebrow: "Social",
        title: "Private Events & Gatherings",
        text: "Birthdays, family reunions, merit-making ceremonies, and community celebrations — each occasion tailored with precision to your vision, guest list, and preferred atmosphere.",
        cta: "Get in Touch"
      }
    ],
    venues: {
      eyebrow: "Our Venues",
      title: "Three iconic spaces.",
      compareLabel: "+ Compare venue capacity",
      gridAria: "Sri U-Thong Grand Hotel event venues",
      enquireAria: (title) => `Enquire about ${title}`,
      badge: "Venue",
      bestFor: "Best for",
      exploreMore: "Explore more",
      plannerLabel: "Talk to our events team"
    },
    venueList: {
      ballroom: {
        title: "The Grand Ballroom",
        capacity: "Gala dinners, wedding receptions, banquets, and large conferences",
        text: "Suphanburi's most prestigious event space. Soaring ceilings, sophisticated acoustic engineering, and a dynamic lighting system create an unforgettable atmosphere for the province's most important gatherings."
      },
      morakot: {
        title: "Morakot Room",
        capacity: "Seminars, training sessions, and private events",
        text: "A focused, well-appointed environment equipped with full audiovisual capabilities. The Morakot Room ensures seamless collaboration and absolute clarity for your most critical professional engagements."
      },
      busarakam: {
        title: "Busarakam Room",
        capacity: "Board meetings, executive briefings, and private discussions",
        text: "An intimate, discreet setting designed for board-level meetings and high-level negotiations. Quiet, composed, and configured to ensure privacy and focus from the first agenda item to the last."
      }
    },
    closing: {
      eyebrow: "Event Enquiries",
      title: "Tell us about your occasion.",
      text: "Share your date, vision, and guest count. Our events team will respond with a tailored proposal.",
      primaryLabel: "Send an Enquiry",
      secondaryLabel: "Call the Hotel"
    }
  },
  location: {
    meta: {
      title: "Location | Sri U-Thong Grand Hotel",
      description: "Sri U-Thong Grand Hotel stands in the heart of central Suphanburi — an unrivalled base for exploring the province's temples, markets, and cultural landmarks."
    },
    sectionNav: [
      {
        id: "location-highlights",
        label: "Highlights"
      },
      {
        id: "location-access",
        label: "Getting Here"
      },
      {
        id: "location-details",
        label: "Details"
      },
      {
        id: "location-cta",
        label: "Stay"
      }
    ],
    hero: {
      title: "Suphanburi's Most Convenient Address",
      text: "Positioned at the centre of the province, within steps of the city's most revered temples, vibrant markets, and cultural landmarks.",
      primaryLabel: "Get Directions",
      secondaryLabel: "Contact Concierge"
    },
    recommends: {
      eyebrow: "Concierge Picks",
      title: "Places Worth Visiting",
      shareLabel: "Share",
      controlsLabel: "Browse Suphanburi highlights",
      previousHighlight: "Previous highlight",
      nextHighlight: "Next highlight",
      cardEyebrow: "Recommended Nearby"
    },
    access: {
      eyebrow: "Getting Here",
      title: "A natural gateway to the province",
      lead: "Our address in central Suphanburi places every major landmark within easy reach. Step out and explore the city's temples, markets, and towers, then return to the calm of a well-appointed room. On-site parking, proximity to the main road network, and a straightforward two-hour drive from Bangkok make arrival — and every day trip — effortless."
    },
    highlights: {
      "Wat Pa Lelai Worawihan": {
        title: "Wat Pa Lelai Worawihan",
        text: "One of Suphanburi's most revered Buddhist temples, home to a magnificent reclining Buddha and centuries of spiritual heritage. A short walk from the hotel."
      },
      "Dragon Descendants Museum": {
        title: "Dragon Descendants Museum",
        text: "An architectural landmark 1.7 km away, tracing the shared heritage of Thai and Chinese communities across thousands of years of cultural history."
      },
      "Banharn-Jamsai Tower": {
        title: "Banharn-Jamsai Tower",
        text: "Thailand's tallest pagoda-style tower stands just moments from the hotel. Ascend to the observation deck for sweeping panoramas of the province's urban and natural landscape."
      },
      "Sam Chuk Old Market": {
        title: "Sam Chuk Old Market",
        text: "A beautifully preserved century-old market town, thirty minutes away. Wander the traditional shophouses, savour local street food, and discover authentic provincial life."
      },
      "Bueng Chawak": {
        title: "Bueng Chawak",
        text: "A serene freshwater lake and nature park popular with families and nature lovers — an ideal half-day excursion from the hotel into Suphanburi's verdant landscape."
      }
    },
    details: [
      {
        strong: "Adjacent to the park",
        text: "Bordered by the verdant Chaloem Phatthara Rachini Park."
      },
      {
        strong: "City centre",
        text: "Walking distance to the provincial business district."
      },
      {
        strong: "2 km",
        text: "To the provincial hall."
      },
      {
        strong: "~100 km",
        text: "Approximately two hours by car from Bangkok."
      }
    ],
    closing: {
      eyebrow: "Arrive with Ease",
      title: "Make Sri U-Thong Grand your Suphanburi base.",
      text: "Check availability or contact our concierge to arrange a seamless arrival.",
      primaryLabel: "Check Availability",
      secondaryLabel: "Contact Concierge"
    }
  },
  gallery: {
    intro: {
      title: "A Look Inside",
      text: "Explore the architecture, interiors, event spaces, and gardens that define the Sri U-Thong Grand experience."
    },
    sectionEyebrow: "Photography",
    metaTitleSuffix: "Sri U-Thong Grand Hotel",
    heroPrimaryLabel: "Reserve a Room",
    heroSecondaryLabel: "Explore the Gallery",
    openPhotoAria: (label) => `Open ${label} photo`,
    controlsAria: (label) => `${label} photo controls`,
    previousPhotoAria: (label) => `Previous ${label} photo`,
    nextPhotoAria: (label) => `Next ${label} photo`,
    closing: {
      eyebrow: "Plan Your Visit",
      title: "Reserve your room at Sri U-Thong Grand.",
      text: "Browse our room collection or open the booking panel to check availability and secure your stay.",
      primaryLabel: "Check Availability",
      secondaryLabel: "View Rooms"
    },
    dialogClose: "Close",
    dialogCaptionFallback: "Sri U-Thong Grand Hotel",
    sliderFallbackLabel: "Room photo"
  },
  contact: {
    meta: {
      title: "Contact | Sri U-Thong Grand Hotel",
      description: "Reach Sri U-Thong Grand Hotel for room reservations, dining arrangements, event planning, or any enquiry. Our team responds promptly."
    },
    sectionNav: [
      {
        id: "contact-details",
        label: "Contact"
      },
      {
        id: "hotel-enquiry",
        label: "Enquiry"
      }
    ],
    hero: {
      title: "We Are Here for You",
      text: "For room enquiries, dining reservations, event planning, or any request — our team is ready to assist.",
      primaryLabel: `Call ${sharedSite.phoneDisplay}`,
      secondaryLabel: "Send an Enquiry"
    },
    details: {
      eyebrow: "Hotel Concierge",
      title: "Speak with our team.",
      lead: "Reach us by phone or email — we respond the same day. You can also find us on Agoda and Facebook. Our official LINE channel is coming soon.",
      addressLabel: "Address",
      telLabel: "Tel",
      faxLabel: "Fax",
      emailLabel: "Email"
    },
    form: {
      name: "Name *",
      email: "Email",
      phone: "Phone *",
      topic: "Type of enquiry",
      topics: [
        {
          value: "Room booking enquiry",
          label: "Room reservation"
        },
        {
          value: "Dining arrangement",
          label: "Dining arrangement"
        },
        {
          value: "Meeting or event",
          label: "Meeting or event"
        },
        {
          value: "General question",
          label: "General question"
        }
      ],
      checkin: "Check-in",
      checkout: "Check-out",
      guestSummary: "Guests",
      guestSummaryPlaceholder: "1 room, 2 adults",
      promoCode: "Promo code",
      promoPlaceholder: "Optional — leave blank if none",
      message: "Message *",
      messagePlaceholder: "Tell us your dates, number of guests, or the nature of your enquiry.",
      requiredNotice: "Fields marked * are required.",
      successNotice: "Thank you — your message has been received. A member of our team will be in touch shortly.",
      errorNotice: "Your message could not be sent right now. Please try again, or reach us directly by phone or email.",
      submitLabel: "Send Enquiry"
    }
  },
  newsIndex: {
    meta: {
      title: "Journal | Sri U-Thong Grand Hotel",
      description: "Hotel stories, Suphanburi travel guides, and curated local insights from Sri U-Thong Grand Hotel."
    },
    hero: {
      eyebrow: "Journal",
      title: "Stories from the City",
      lead: "Curated travel insights, dining highlights, and local guides for the curious guest visiting Suphanburi."
    },
    section: {
      eyebrow: "Latest",
      title: "From the journal",
      lead: "New stories and guides are published as we add them."
    },
    empty: {
      title: "Stories are being prepared.",
      text: "We are composing our first journal entries. Return shortly for Suphanburi travel guides and hotel news."
    }
  },
  newsArticle: {
    allNews: "All Posts",
    stayEyebrow: "Stay with Us",
    stayTitle: "Suphanburi's most convenient address",
    stayText: "Sri U-Thong Grand Hotel is steps from the city's most revered landmarks. Book direct for the best available rate.",
    stayButton: "Book Direct"
  }
};

const th = {
  site: {
    ...sharedSite,
    phoneShortLabel: "โทร",
    faxShortLabel: "แฟกซ์",
    localeDate: "th-TH",
    localeArticleDate: "th-TH",
    brandHomeLabel: "หน้าหลัก โรงแรมศรีอู่ทองแกรนด์",
    languageOptionsLabel: "ตัวเลือกภาษา",
    sectionNavigationLabel: "เมนูภายในหน้า",
    switchToThai: "เปลี่ยนภาษาเป็นภาษาไทย",
    switchToEnglish: "เปลี่ยนภาษาเป็นภาษาอังกฤษ",
    mapTitle: "แผนที่โรงแรมศรีอู่ทองแกรนด์",
    photoViewerLabel: "ภาพถ่ายโรงแรมศรีอู่ทองแกรนด์",
    schemaAmenity: "ทำเลใจกลางเมืองสุพรรณบุรี",
    locationShareTitle: "ไฮไลต์น่าสนใจในสุพรรณบุรี ใกล้โรงแรมศรีอู่ทองแกรนด์",
    locationShareText: "สถานที่แนะนำโดยโรงแรมศรีอู่ทองแกรนด์ สุพรรณบุรี"
  },
  bookingBar: {
    datesEyebrow: "วันที่เข้าพัก",
    datesTitle: "วางแผนการเข้าพักของคุณ",
    guestsEyebrow: "ผู้เข้าพัก",
    guestsTitle: "จำนวนผู้เข้าพัก",
    codesEyebrow: "รหัสพิเศษ",
    codesTitle: "รหัสโปรโมชันหรือองค์กร",
    backToReserveDetails: "กลับไปยังรายละเอียดการจอง",
    closeDateSelection: "ปิดการเลือกวันที่",
    closeGuestDetails: "ปิดรายละเอียดผู้เข้าพัก",
    closeSpecialCodes: "ปิดรหัสโปรโมชัน",
    checkInLabel: "วันเข้าพัก",
    checkOutLabel: "วันออก",
    selectDate: "เลือกวันที่",
    previousMonth: "เดือนก่อนหน้า",
    nextMonth: "เดือนถัดไป",
    calendarLabel: "ปฏิทินเลือกวันเข้าพัก",
    datesNote: "โปรดระบุวันที่เข้าพัก และวันที่เช็คเอาท์",
    adultsLabel: "ผู้ใหญ่",
    adultsNote: "อายุ 8 ปีขึ้นไป",
    childrenLabel: "เด็ก",
    childrenNote: "อายุ 0–7 ปี",
    roomsLabel: "ห้องพัก",
    roomsNote: "คุณสามารถปรับเปลี่ยนจำนวนห้องได้อีกครั้ง หลังจากเลือกประเภทห้องพัก",
    guestCountsNote: "จำนวนผู้เข้าพักและห้องพักจะถูกส่งไปยังระบบจองเมื่อเชื่อมต่อ IBE แล้ว",
    confirmGuests: "ยืนยันจำนวนผู้เข้าพัก",
    codeLabel: "รหัสโปรโมชันหรือองค์กร",
    codePlaceholder: "กรอกรหัสที่นี่",
    codeNote: "เว้นว่างได้หากไม่มีรหัส",
    confirmCode: "ใช้รหัส",
    submitReady: "รายละเอียดการจองเรียบร้อยแล้ว โปรดเชื่อมต่อ PUBLIC_SUT_IBE_URL หลังจากการทดสอบ เพื่อนำผู้เข้าพักเข้าสู่ระบบการจองโดยตรง",
    weekdays: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."],
    client: {
      localeDate: "th-TH",
      chooseStay: "เลือกวันเข้าพัก",
      selectDates: "เลือกวันเข้าพักและวันออก",
      defaultNight: "1 คืน",
      nightSingular: "คืน",
      nightPlural: "คืน",
      staySuffix: "",
      previewSuffix: "ตัวอย่าง",
      selectCheckout: "เลือกวันออก",
      chooseCheckoutDate: "เลือกวันออก",
      selectDate: "เลือกวันที่",
      addCode: "เพิ่มรหัสโปรโมชัน",
      adultSingular: "ผู้ใหญ่",
      adultPlural: "ผู้ใหญ่",
      childSingular: "เด็ก",
      childPlural: "เด็ก",
      roomSingular: "ห้อง",
      roomPlural: "ห้อง",
      weekdays: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]
    }
  },
  latestNews: {
    readArticle: "อ่านต่อ",
    viewAll: "ดูทั้งหมด",
    emptyTitle: "กำลังเตรียมเนื้อหา",
    emptyText: "ข่าวสารโรงแรมและคู่มือท่องเที่ยวสุพรรณบุรีจะปรากฏที่นี่เมื่อเผยแพร่แล้ว",
    articleLinkAria: (title) => `อ่าน ${title}`,
    coverAlt: (title) => `ภาพปก ${title}`,
    tagsAria: "หมวดหมู่บทความ"
  },
  contactOptions: {
    call: "โทร",
    email: "อีเมล",
    line: "LINE",
    lineStatus: "เปิดให้บริการเร็วๆ นี้",
    lineAria: "บัญชี LINE ทางการยังไม่เปิดใช้งาน",
    agoda: "Agoda",
    agodaStatus: "ดูโรงแรมบน Agoda",
    facebook: "Facebook",
    facebookStatus: "ดูเพจ Facebook ของโรงแรม"
  },
  roomCard: {
    amenitiesAria: (title) => `สิ่งอำนวยความสะดวกของ ${title}`,
    photographyLabel: "ดูภาพห้องพัก",
    availabilityLabel: "สำรองห้องนี้"
  },
  home: {
    meta: {
      title: "โรงแรมหรูใจกลางสุพรรณบุรี | ศรีอู่ทองแกรนด์โฮเทล",
      description: "ค้นพบความสงบงามและมนต์เสน่ห์แห่งสุพรรณบุรีที่ โรงแรมศรีอู่ทองแกรนด์ พื้นที่พักผ่อนที่ผสานการออกแบบอย่างพิถีพิถันเข้ากับการบริการที่อบอุ่นแบบไทย เพื่อต้อนรับทุกการมาเยือนของคุณ"
    },
    hero: {
      eyebrow: "",
      title: "สัมผัสเสน่ห์และชีวิตชีวาแห่งสุพรรณบุรี",
      text: "",
      primaryLabel: "สำรองห้องพัก",
      secondaryLabel: "ชมบริเวณโรงแรม"
    },
    sectionNav: {
      ariaLabel: "เมนูภายในหน้า",
      items: [
        {
          id: "home-overview",
          label: "ภาพรวม"
        },
        {
          id: "home-rooms",
          label: "ห้องพัก"
        },
        {
          id: "home-dining",
          label: "ห้องอาหาร"
        },
        {
          id: "home-events",
          label: "งานกิจกรรม"
        },
        {
          id: "home-news",
          label: "บันทึก"
        },
        {
          id: "home-location",
          label: "ที่ตั้ง"
        }
      ]
    },
    directBar: {
      locationLink: "ดูแผนที่"
    },
    overview: {
      eyebrow: "โรงแรมชั้นนำแห่งสุพรรณบุรี",
      title: "สถานที่พักผ่อนระดับพรีเมียมใจกลางเมือง",
      lead: "โรงแรมศรีอู่ทองแกรนด์ ตั้งอยู่บนทำเลที่ดีที่สุดใจกลางเมือง โดดเด่นด้วยสัมผัสอันอบอุ่นของไม้สัก การตกแต่งที่นุ่มนวล และการบริการที่ใส่ใจในทุกรายละเอียด ที่นี่คือพื้นที่พักผ่อนอันเงียบสงบและสง่างาม พร้อมเป็นจุดเริ่มต้นให้คุณได้สัมผัสทุกมิติของสุพรรณบุรี",
      facts: [
        {
          strong: "ทำเลเยี่ยม",
          text: "ใกล้แหล่งวัฒนธรรมและธุรกิจสำคัญของเมือง"
        },
        {
          strong: "2 กม.",
          text: "ถึงศาลากลางจังหวัด"
        },
        {
          strong: "2 ชั่วโมง",
          text: "การเดินทางที่แสนผ่อนคลายจากกรุงเทพฯ"
        }
      ]
    },
    rooms: {
      eyebrow: "ที่พัก",
      title: "ห้องพักและห้องสวีท",
      lead: "ค้นพบความสะดวกสบายจากห้องพัก 6 รูปแบบที่ตอบโจทย์ทุกการเดินทาง ดื่มด่ำกับเสน่ห์อันคลาสสิกของ Heritage Series หรือยกระดับประสบการณ์พักผ่อนกับ Premier Series บนชั้น 6 ที่เพิ่งได้รับการปรับโฉมใหม่ พร้อมการตกแต่งอย่างประณีต"
    },
    dining: {
      eyebrow: "ห้องอาหาร",
      title: "จุดหมายปลายทางแห่งรสชาติ",
      lead: "ลิ้มรสอาหารไทยต้นตำรับที่รังสรรค์จากวัตถุดิบท้องถิ่นเคียงคู่กับเมนูนานาชาติยอดนิยม ไม่ว่าจะเป็นมื้อเช้าท่ามกลางแสงแดดอ่อนๆ หรือมื้อค่ำอันแสนผ่อนคลาย ทุกมื้ออาหารที่นี่คือช่วงเวลาอันน่าประทับใจ",
      primaryLabel: "ดูข้อมูลห้องอาหาร",
      secondaryLabel: "จัดงานส่วนตัว"
    },
    events: {
      eyebrow: "ประชุมและงานกิจกรรม",
      title: "สถานที่ที่ทุกความทรงจำถูกเนรมิตให้เป็นจริง",
      lead: "พื้นที่จัดงานทั้ง 3 แห่งของเราพร้อมรองรับทุกช่วงเวลาสำคัญ ตั้งแต่การประชุมระดับผู้บริหารไปจนถึงงานวิวาห์อันสง่างาม ทีมงานผู้เชี่ยวชาญของเราพร้อมดูแลทุกรายละเอียดอย่างประณีต เพื่อให้ทุกงานของคุณสมบูรณ์แบบอย่างไร้ที่ติ",
      primaryLabel: "วางแผนงาน",
      slideshowLabel: "ภาพพื้นที่ประชุมและงานกิจกรรม",
      controlsLabel: "เลือกดูภาพงาน",
      previousImage: "ภาพก่อนหน้า",
      nextImage: "ภาพถัดไป",
      showImage: (title) => `ดูภาพ ${title}`
    },
    news: {
      eyebrow: "บันทึก",
      title: "เรื่องเล่าจากเมืองสุพรรณ",
      text: "ข้อมูลเชิงลึกด้านการท่องเที่ยว ไฮไลท์ด้านอาหาร และคู่มือสุพรรณบุรีสำหรับนักเดินทางผู้ใฝ่รู้"
    },
    location: {
      eyebrow: "ที่ตั้ง",
      title: "ศูนย์กลางแห่งทุกจุดหมาย",
      lead: "เพียงก้าวออกจากโรงแรม คุณก็สามารถเข้าถึงวัดวาอาราม ตลาด และสถานที่สำคัญทางวัฒนธรรมของสุพรรณบุรีได้อย่างง่ายดาย ก่อนจะกลับมาผ่อนคลายในห้องพักที่จัดเตรียมไว้อย่างพิถีพิถัน เพราะที่นี่... สุพรรณบุรีพร้อมให้คุณสำรวจในจังหวะของคุณเอง",
      primaryLabel: "สำรวจที่ตั้ง",
      secondaryLabel: "ติดต่อทีมผู้เชี่ยวชาญ"
    }
  },
  rooms: {
    meta: {
      title: "ห้องพักและห้องสวีท | ศรีอู่ทองแกรนด์",
      description: "สัมผัสประสบการณ์พักผ่อนในห้องพัก 6 รูปแบบที่ โรงแรมศรีอู่ทองแกรนด์ ตั้งแต่ Classic Room อันอบอุ่น ไปจนถึงความโอ่อ่าของ Grand Residence ออกแบบมาเพื่อการพักผ่อนอย่างแท้จริง"
    },
    sectionNav: [
      {
        id: "rooms-collection",
        label: "ภาพรวม"
      },
      {
        id: "premier-series",
        label: "พรีเมียร์"
      },
      {
        id: "heritage-series",
        label: "เฮอริเทจ"
      },
      {
        id: "rooms-cta",
        label: "สำรอง"
      }
    ],
    hero: {
      title: "ห้องพักและห้องสวีท",
      text: "ห้องพัก 6 รูปแบบที่ตอบโจทย์ทุกความต้องการ Premier Series บนชั้น 6 ที่ปรับโฉมใหม่ พร้อมการตกแต่งที่หรูหรา ขณะที่ Heritage Series มอบความอบอุ่น คลาสสิก และความคุ้มค่าที่เหนือกว่า",
      primaryLabel: "ตรวจสอบห้องว่าง",
      secondaryLabel: "ดูภาพห้องพัก"
    },
    intro: {
      eyebrow: "คอลเลกชัน",
      title: "ออกแบบเพื่อการพักผ่อนอย่างแท้จริง",
      lead: "ทุกห้องพักที่ ศรีอู่ทองแกรนด์ คือพื้นที่พักผ่อนที่ได้รับการออกแบบอย่างใส่ใจ แสงธรรมชาติที่สาดส่อง เตียงนอนหนานุ่ม และการตกแต่งด้วยไม้สักอันอบอุ่น สร้างบรรยากาศแห่งการฟื้นฟูร่างกายและจิตใจหลังจากการสำรวจเมืองมาทั้งวัน ตั้งแต่ห้องพักมาตรฐานที่แสนสบายไปจนถึงห้องสวีทที่หรูหราที่สุดของเรา ทุกตารางนิ้วได้รับการดูแลอย่างพิถีพิถันเพื่อมอบประสบการณ์ที่ดีที่สุดให้แก่คุณ"
    },
    filter: {
      ariaLabel: "กรองตามซีรีส์ห้องพัก",
      prompt: "เลือกดู",
      all: "ทุกประเภท",
      premier: "Premier Series",
      heritage: "Heritage Series"
    },
    closing: {
      eyebrow: "การเข้าพักของคุณ",
      title: "ค้นหาห้องพักที่สมบูรณ์แบบสำหรับคุณ",
      text: "ระบุวันที่และจำนวนผู้เข้าพักเพื่อดูห้องพักที่มีว่างสำหรับการเดินทางของคุณ",
      primaryLabel: "ตรวจสอบห้องว่าง",
      secondaryLabel: "ติดต่อฝ่ายสำรองที่พัก"
    },
    categories: {
      classic: {
        title: "ห้องคลาสสิก",
        statement: "พื้นที่พักผ่อนอันอบอุ่น สำหรับนักเดินทางร่วมสมัย",
        desc: "ห้อง Classic ผสานความสะดวกสบายเข้ากับการออกแบบที่เรียบหรู เจือกลิ่นอายความเป็นไทยอย่างลงตัว ทิ้งตัวลงบนเตียงหนานุ่มที่ปูด้วยผ้าลินินคุณภาพสูง แล้วตื่นรับวันใหม่ด้วยความสดชื่น นี่คือโอเอซิสอันเงียบสงบหลังจากใช้เวลาทั้งวันในเมือง",
        ideal: "เหมาะสำหรับ: ผู้เดินทางคนเดียวและคู่รักที่มาพักในเมือง",
        features: ["เลือกได้ทั้งแบบเตียงใหญ่ (Double) หรือเตียงคู่ (Twin)", "บริการอาหารเช้าฟรี", "รองรับผู้เข้าพักสูงสุด 2 ท่าน"]
      },
      deluxe: {
        title: "ห้องดีลักซ์",
        statement: "พื้นที่กว้างขวาง เพื่อทุกช่วงเวลาที่มีความหมายร่วมกัน",
        desc: "ห้อง Deluxe มอบพื้นที่กว้างขวางที่ออกแบบมาเพื่อครอบครัวและกลุ่มเพื่อนที่ต้องการความโปร่งสบาย แสงธรรมชาติส่องผ่านหน้าต่างบานใหญ่ พร้อมมุมนั่งเล่นส่วนตัวที่เชิญชวนให้คุณได้นั่งคุยและผ่อนคลายอย่างเต็มที่",
        ideal: "เหมาะสำหรับ: ครอบครัวและกลุ่มที่แสวงหาความสะดวกสบายร่วมกัน",
        features: ["เตียงใหญ่ 1 เตียง และเตียงเล็ก 1 เตียง", "บริการอาหารเช้าฟรี", "รองรับผู้เข้าพักสูงสุด 3 ท่าน"]
      },
      studiosuite: {
        title: "สตูดิโอ สวีท",
        statement: "สัมผัสบรรยากาศเสมือนบ้าน สำหรับการเข้าพักที่ยาวนานขึ้น",
        desc: "Studio Suite ถูกออกแบบโดยแบ่งสัดส่วนพื้นที่พักผ่อนและพื้นที่ใช้สอยอย่างตั้งใจ ห้องนอนแสนสบายในด้านหนึ่ง และมุมนั่งเล่นพักผ่อนในอีกด้านหนึ่ง สัมผัสความอิสระของพื้นที่ที่ให้คุณได้ทำงาน พักผ่อน หรือเพียงแค่ปล่อยใจให้สบาย ตอบโจทย์ผู้ที่รักการเดินทางแบบเนิบช้า",
        features: ["เตียงใหญ่ 1 เตียง", "บริการอาหารเช้าฟรี", "รองรับผู้เข้าพักสูงสุด 2 ท่าน"]
      },
      executive: {
        title: "ห้องเอ็กเซ็กคิวทีฟ",
        statement: "บนชั้น 6 กับการตกแต่งที่หรูหรา ในรูปโฉมใหม่ที่งดงาม",
        desc: "ห้อง Executive ตั้งอยู่บนชั้น 6 ที่ได้รับการปรับปรุงใหม่ สัมผัสความประณีตในการตกแต่งและบรรยากาศอันสงบงาม ทุกรายละเอียดถูกคัดสรรมาอย่างตั้งใจเพื่อมอบความสะดวกสบายและสะท้อนรสนิยมเหนือระดับในทุกการเข้าพัก",
        features: ["เลือกได้ทั้งแบบเตียงใหญ่ (Double) หรือเตียงคู่ (Twin)", "บริการอาหารเช้าฟรี", "รองรับผู้เข้าพักสูงสุด 2 ท่าน"]
      },
      execsuite: {
        title: "เอ็กเซ็กคิวทีฟ สวีท",
        statement: "แยกสัดส่วนห้องนั่งเล่นและห้องนอนอย่างลงตัว บนชั้น 6",
        desc: "Executive Suite มอบความเป็นส่วนตัวด้วยการแบ่งสัดส่วนห้องอย่างชัดเจน ห้องนั่งเล่นที่ตกแต่งอย่างหรูหราเชื่อมต่อกับห้องนอน มอบพื้นที่อันสงบงามสำหรับการประชุมส่วนตัวหรือค่ำคืนแห่งการพักผ่อนที่ปราศจากการรบกวน รังสรรค์ขึ้นสำหรับผู้ที่ให้ความสำคัญกับพื้นที่กว้างขวางทัดเทียมกับความสะดวกสบาย",
        features: ["เตียงใหญ่ 1 เตียง", "บริการอาหารเช้าฟรี", "รองรับผู้เข้าพักสูงสุด 2 ท่าน"]
      },
      grandres: {
        title: "แกรนด์ เรสซิเดนซ์",
        statement: "ที่สุดแห่งความภาคภูมิของโรงแรม — หรูหรา สง่างาม และกว้างขวาง",
        desc: "ความเหนือระดับที่โดดเด่นที่สุดของ ศรีอู่ทองแกรนด์ ห้อง Grand Residence นำเสนอพื้นที่โอ่โถง พร้อมห้องนั่งเล่นที่เป็นทางการ พื้นที่สังสรรค์กว้างขวาง และเฟอร์นิเจอร์ที่สั่งทำพิเศษ ออกแบบมาสำหรับผู้ที่ต้องการจัดงานต้อนรับ เฉลิมฉลอง หรือเพียงแค่ใช้เวลาในพื้นที่ที่สะท้อนความสง่างามอย่างแท้จริง",
        features: ["เตียงคิงไซส์ 1 เตียง", "บริการอาหารเช้าฟรี", "รองรับผู้เข้าพักสูงสุด 3 ท่าน"]
      }
    }
  },
  dining: {
    meta: {
      title: "ห้องอาหาร | ศรีอู่ทองแกรนด์",
      description: "ลิ้มรสอาหารไทยแท้และเมนูนานาชาติที่โรงแรมศรีอู่ทองแกรนด์ บริการอาหารเช้าทุกวัน พร้อมรองรับงานส่วนตัวและกลุ่มในสุพรรณบุรี"
    },
    sectionNav: [
      {
        id: "dining-overview",
        label: "ภาพรวม"
      },
      {
        id: "dining-enquiries",
        label: "สอบถาม"
      }
    ],
    hero: {
      title: "จุดหมายแห่งรสชาติ",
      text: "รสชาติแท้ วัตถุดิบดี บรรยากาศอบอุ่นและผ่อนคลาย — ตั้งแต่กาแฟแก้วแรกของเช้าจนถึงมื้อสุดท้ายของคืน",
      primaryLabel: "สอบถามเรื่องห้องอาหาร",
      secondaryLabel: "ติดต่อโรงแรม"
    },
    overview: {
      eyebrow: "ห้องอาหาร",
      title: "เติมเต็มความหมายให้ทุกมื้ออาหาร",
      lead: "ห้องอาหารของโรงแรมคือพื้นที่อันโปร่งสบายและเงียบสงบ ที่พร้อมเปลี่ยนผ่านจากมื้อเช้าอันสดใส ไปสู่บรรยากาศการรับประทานอาหารที่ผ่อนคลายตลอดทั้งวัน ทุกจานรังสรรค์ขึ้นจากวัตถุดิบท้องถิ่นชั้นเลิศ ผสานเทคนิคการปรุงอาหารไทยพื้นถิ่นขนานแท้ เคียงคู่ไปกับเมนูนานาชาติที่คัดสรรมาอย่างดี"
    },
    overviewCards: [
      {
        slug: "morning",
        eyebrow: "อาหารเช้า",
        title: "พิธีกรรมยามเช้า",
        text: "เริ่มต้นวันใหม่ด้วยการคัดสรรเมนูสไตล์คอนติเนนตัลสุดคลาสสิกและอาหารท้องถิ่นรสเลิศ ภายใต้บรรยากาศที่สว่างไสว กลิ่นหอมของกาแฟคั่วบดใหม่ และการบริการที่แสนอบอุ่นและรู้ใจ — นี่คือการเริ่มต้นวันที่พร้อมเติมเต็มพลังให้คุณ",
        cta: "สอบถามอาหารเช้า"
      },
      {
        slug: "evening",
        eyebrow: "มื้อกลางวัน–เย็น",
        title: "ดื่มด่ำไปกับรสชาติทั้งวัน",
        text: "ห้องอาหารของเราให้บริการมื้อกลางวันและมื้อค่ำในบรรยากาศที่เป็นกันเองและผ่อนคลาย นำเสนอเมนูอาหารไทยยอดนิยมจากวัตถุดิบท้องถิ่น พร้อมด้วยเมนูนานาชาติจานโปรด — หลากหลายรสชาติที่ชวนให้คุณอยากใช้เวลาดื่มด่ำนานยิ่งขึ้น",
        cta: "ติดต่อทีมอาหาร"
      },
      {
        slug: "groups",
        eyebrow: "งานส่วนตัวและกลุ่ม",
        title: "อาหารกลุ่มและงานส่วนตัว",
        text: "สำหรับการเฉลิมฉลองในครอบครัว งานเลี้ยงอาหารกลางวันขององค์กร หรือมื้อค่ำแบบส่วนตัว ทีมงานของเราพร้อมจัดเตรียมพื้นที่เฉพาะและรังสรรค์เมนูที่ตอบโจทย์ความต้องการของคุณ ด้วยความใส่ใจในทุกรายละเอียด",
        cta: "จัดงานอาหาร"
      }
    ],
    enquiries: {
      eyebrow: "สอบถามเรื่องห้องอาหาร",
      title: "ให้เราดูแลมื้อพิเศษของคุณ",
      lead: "สำหรับการจองกลุ่ม อาหารส่วนตัว หรือการจัดเลี้ยงงาน ติดต่อทีมงานของเราและเราจะดูแลทุกรายละเอียดให้",
      primaryLabel: "ติดต่อโรงแรม",
      secondaryLabel: "โทรเลย"
    }
  },
  meetingsEvents: {
    meta: {
      title: "ประชุมและงานกิจกรรม | ศรีอู่ทองแกรนด์",
      description: "สถานที่จัดงานระดับพรีเมียมสำหรับการประชุมองค์กร สัมมนา งานเลี้ยงกาล่า และงานวิวาห์ที่โรงแรมศรีอู่ทองแกรนด์ สุพรรณบุรี"
    },
    sectionNav: [
      {
        id: "events-overview",
        label: "ภาพรวม"
      },
      {
        id: "venues",
        label: "สถานที่"
      },
      {
        id: "events-cta",
        label: "สอบถาม"
      }
    ],
    hero: {
      title: "ที่ที่ทุกโอกาสมีชีวิต",
      text: "สถานที่จัดงานระดับพรีเมียม 3 แห่งสำหรับการประชุมองค์กร งานฉลองสำคัญ และงานวิวาห์อันทรงคุณค่า — ทุกงานส่งมอบด้วยการบริการที่ราบรื่นและเป็นส่วนตัว",
      primaryLabel: "วางแผนงาน",
      secondaryLabel: "ติดต่อทีมงาน"
    },
    overview: {
      eyebrow: "พื้นที่จัดงาน",
      title: "รังสรรค์ทุกความสมบูรณ์แบบ ในพื้นที่จัดงานอันสง่างาม",
      lead: "ตั้งแต่การประชุมระดับผู้บริหารที่สำคัญ ไปจนถึงงานวิวาห์ที่เปี่ยมด้วยความทรงจำ โรงแรมศรีอู่ทองแกรนด์พร้อมเนรมิตทุกความต้องการด้วยสถาปัตยกรรมอันโอ่อ่าและเทคโนโลยีอันทันสมัย ทีมงานจัดงานผู้เชี่ยวชาญของเราจะดูแลทุกรายละเอียด — ไม่ว่าจะเป็นการจัดสถานที่ อาหาร ลำดับพิธีการ หรือการดำเนินงาน — ด้วยความแม่นยำและใส่ใจสูงสุด"
    },
    overviewCards: [
      {
        slug: "meetings",
        eyebrow: "องค์กร",
        title: "ประชุมและสัมมนา",
        text: "พื้นที่ล้ำสมัยสำหรับการประชุมทีม การฝึกอบรม สัมมนา และการบรรยายสำหรับผู้บริหาร พร้อมระบบโสตทัศนูปกรณ์ครบครันและทีมงานดูแลอย่างใกล้ชิดตลอดงาน",
        cta: "สอบถามตอนนี้"
      },
      {
        slug: "celebrations",
        eyebrow: "งานวิวาห์",
        title: "ความรักเหนือกาลเวลา",
        text: "เมื่อความโรแมนติกเหนือกาลเวลาผสานเข้ากับการเฉลิมฉลองที่ออกแบบมาเพื่อคุณโดยเฉพาะ ผู้เชี่ยวชาญด้านงานวิวาห์ของเราพร้อมเนรมิตทุกองค์ประกอบ — ตั้งแต่การจัดดอกไม้อันวิจิตรไปจนถึงการเต้นรำในจังหวะสุดท้าย — เพื่อให้คุณได้ดื่มด่ำกับทุกช่วงเวลาสำคัญอย่างเต็มที่",
        cta: "วางแผนงานวิวาห์"
      },
      {
        slug: "groups",
        eyebrow: "งานสังคม",
        title: "งานส่วนตัวและงานชุมชน",
        text: "งานวันเกิด งานรวมญาติ งานบุญ และงานเฉลิมฉลองของชุมชน — ทุกโอกาสล้วนได้รับการออกแบบอย่างพิถีพิถันให้สอดคล้องกับภาพในฝัน รายชื่อแขก และบรรยากาศที่คุณต้องการ",
        cta: "ติดต่อเรา"
      }
    ],
    venues: {
      eyebrow: "สถานที่จัดงาน",
      title: "สถานที่อันเป็นเอกลักษณ์ทั้ง 3 แห่ง",
      compareLabel: "+ เปรียบเทียบขนาดและความจุ",
      gridAria: "สถานที่จัดงานโรงแรมศรีอู่ทองแกรนด์",
      enquireAria: (title) => `สอบถามเกี่ยวกับ ${title}`,
      badge: "สถานที่",
      bestFor: "เหมาะที่สุดสำหรับ",
      exploreMore: "สำรวจเพิ่มเติม",
      plannerLabel: "ติดต่อทีมจัดงาน"
    },
    venueList: {
      ballroom: {
        title: "แกรนด์ บอลรูม",
        capacity: "งานวิวาห์ งานเลี้ยงกาล่า งานเลี้ยงอาหารค่ำ และการประชุมขนาดใหญ่",
        text: "พื้นที่จัดงานที่โอ่อ่าและสง่างามที่สุดในสุพรรณบุรี โดดเด่นด้วยเพดานสูงโปร่ง ระบบเสียงที่ออกแบบมาอย่างพิถีพิถัน และระบบไฟที่ปรับเปลี่ยนได้ตามบรรยากาศ พร้อมเนรมิตความทรงจำอันล้ำค่าสำหรับทุกงานสำคัญของจังหวัด"
      },
      morakot: {
        title: "ห้องมรกต",
        capacity: "สัมมนา การอบรม และงานส่วนตัวขนาดกลาง",
        text: "พื้นที่จัดงานที่มีความเป็นส่วนตัวและตกแต่งอย่างลงตัว พร้อมด้วยระบบภาพและเสียงที่ครบครัน ห้องมรกตรับรองความราบรื่นในการประสานงานและความชัดเจนในทุกการสื่อสาร เพื่อให้การประชุมครั้งสำคัญของคุณประสบความสำเร็จอย่างสมบูรณ์"
      },
      busarakam: {
        title: "ห้องบุษราคัม",
        capacity: "ประชุมคณะกรรมการ บรีฟผู้บริหาร และการประชุมส่วนตัว",
        text: "พื้นที่ส่วนตัวที่ถูกออกแบบมาอย่างพิถีพิถัน สำหรับการประชุมระดับคณะกรรมการและการเจรจาธุรกิจที่สำคัญ สงบ เป็นสัดส่วน และปรับแต่งได้ตามต้องการ เพื่อให้คุณมั่นใจในความเป็นส่วนตัวและสมาธิที่แน่วแน่ตั้งแต่เริ่มต้นจนจบการประชุม"
      }
    },
    closing: {
      eyebrow: "สอบถามงานกิจกรรม",
      title: "ให้เราได้ร่วมเป็นส่วนหนึ่งในวันสำคัญของคุณ",
      text: "แจ้งวันที่ วิสัยทัศน์ และจำนวนแขก ทีมงานของเราจะตอบกลับพร้อมข้อเสนอที่ปรับแต่งเพื่อคุณโดยเฉพาะ",
      primaryLabel: "ส่งคำถาม",
      secondaryLabel: "โทรติดต่อโรงแรม"
    }
  },
  location: {
    meta: {
      title: "ที่ตั้ง | ศรีอู่ทองแกรนด์",
      description: "โรงแรมศรีอู่ทองแกรนด์ตั้งอยู่ใจกลางสุพรรณบุรี ทำเลเยี่ยมใกล้วัด ตลาด และสถานที่สำคัญทางวัฒนธรรมของจังหวัด"
    },
    sectionNav: [
      {
        id: "location-highlights",
        label: "ไฮไลต์"
      },
      {
        id: "location-access",
        label: "การเดินทาง"
      },
      {
        id: "location-details",
        label: "รายละเอียด"
      },
      {
        id: "location-cta",
        label: "เข้าพัก"
      }
    ],
    hero: {
      title: "ที่สุดแห่งทำเลที่ตั้งใจกลางสุพรรณบุรี",
      text: "ตั้งอยู่ใจกลางจังหวัด ห่างจากวัดชั้นนำ ตลาดอันคึกคัก และแลนด์มาร์คทางวัฒนธรรมเพียงไม่กี่ก้าว",
      primaryLabel: "ดูเส้นทาง",
      secondaryLabel: "ติดต่อทีมผู้เชี่ยวชาญ"
    },
    recommends: {
      eyebrow: "แนะนำโดยทีมผู้เชี่ยวชาญ",
      title: "สถานที่ที่คู่ควรแก่การเยี่ยมชม",
      shareLabel: "แชร์",
      controlsLabel: "เลือกดูไฮไลต์สุพรรณบุรี",
      previousHighlight: "ไฮไลต์ก่อนหน้า",
      nextHighlight: "ไฮไลต์ถัดไป",
      cardEyebrow: "แนะนำใกล้เคียง"
    },
    access: {
      eyebrow: "การเดินทาง",
      title: "จุดเริ่มต้นแห่งการสำรวจเมือง",
      lead: "ด้วยทำเลที่ตั้งใจกลางเมืองสุพรรณบุรี คุณจึงสามารถเดินทางไปยังทุกสถานที่สำคัญได้อย่างสะดวกสบาย ก้าวออกไปสัมผัสความงดงามของวัดวาอาราม ตลาดพื้นบ้าน และหอคอยประจำเมือง ก่อนจะกลับมาพักผ่อนในห้องที่จัดเตรียมไว้อย่างพิถีพิถัน พร้อมที่จอดรถกว้างขวาง การเชื่อมต่อกับถนนสายหลัก และระยะทางเพียงสองชั่วโมงจากกรุงเทพฯ ทำให้การเดินทางมาเยือนและการท่องเที่ยวในแต่ละวันของคุณเป็นเรื่องง่ายและไร้กังวล"
    },
    highlights: {
      "Wat Pa Lelai Worawihan": {
        title: "วัดป่าเลไลยก์วรวิหาร",
        text: "หนึ่งในวัดคู่บ้านคู่เมืองที่ศักดิ์สิทธิ์ที่สุดของสุพรรณบุรี เป็นที่ประดิษฐานหลวงพ่อโตอันวิจิตรตระการตา และเต็มเปี่ยมด้วยเรื่องราวทางจิตวิญญาณนับศตวรรษ สามารถเดินไปถึงได้จากโรงแรม"
      },
      "Dragon Descendants Museum": {
        title: "พิพิธภัณฑ์ลูกหลานพันธุ์มังกร",
        text: "แลนด์มาร์คทางสถาปัตยกรรมที่ตั้งอยู่ห่างออกไปเพียง 1.7 กิโลเมตร บอกเล่าเรื่องราวมรดกทางวัฒนธรรมที่สืบทอดร่วมกันระหว่างชุมชนไทยและจีนผ่านประวัติศาสตร์นับพันปี"
      },
      "Banharn-Jamsai Tower": {
        title: "หอคอยบรรหาร–แจ่มใส",
        text: "หอคอยชมวิวแห่งแรกและสูงที่สุดในประเทศไทย ตั้งอยู่ห่างจากโรงแรมเพียงอึดใจ ขึ้นสู่จุดชมวิวชั้นบนสุดเพื่อรับชมทัศนียภาพอันกว้างไกลของเมืองและธรรมชาติในสุพรรณบุรี"
      },
      "Sam Chuk Old Market": {
        title: "ตลาดร้อยปีสามชุก",
        text: "ตลาดโบราณอายุกว่าร้อยปีที่ยังคงความงดงามและมีชีวิตชีวา ห่างออกไปเพียงสามสิบนาที เดินทอดน่องไปตามเรือนแถวไม้ดั้งเดิม ลิ้มรสอาหารท้องถิ่นเลิศรส และสัมผัสวิถีชีวิตดั้งเดิมของจังหวัด"
      },
      "Bueng Chawak": {
        title: "บึงฉวาก",
        text: "บึงน้ำจืดธรรมชาติอันเงียบสงบและอุทยานที่รายล้อมด้วยพื้นที่สีเขียว เหมาะอย่างยิ่งสำหรับครอบครัวและผู้รักธรรมชาติ — อีกหนึ่งจุดหมายปลายทางสำหรับการท่องเที่ยวครึ่งวันที่สมบูรณ์แบบ"
      }
    },
    details: [
      {
        strong: "ติดสวนสาธารณะ",
        text: "อยู่ติดกับสวนเฉลิมภัทรราชินีอันเขียวชอุ่ม"
      },
      {
        strong: "ใจกลางเมือง",
        text: "เดินถึงย่านธุรกิจหลักของจังหวัดได้อย่างสะดวก"
      },
      {
        strong: "2 กม.",
        text: "ถึงศาลากลางจังหวัด"
      },
      {
        strong: "~100 กม.",
        text: "ประมาณ 2 ชั่วโมงโดยรถยนต์จากกรุงเทพฯ"
      }
    ],
    closing: {
      eyebrow: "เดินทางมาถึงอย่างสบายใจ",
      title: "ให้ ศรีอู่ทองแกรนด์ เป็นจุดเริ่มต้นการเดินทางของคุณ",
      text: "ตรวจสอบห้องว่างหรือติดต่อทีมผู้เชี่ยวชาญของเราเพื่อจัดเตรียมการเดินทางมาถึงอย่างราบรื่น",
      primaryLabel: "ตรวจสอบห้องว่าง",
      secondaryLabel: "ติดต่อทีมผู้เชี่ยวชาญ"
    }
  },
  gallery: {
    intro: {
      title: "ภายในโรงแรม",
      text: "สำรวจสถาปัตยกรรม ห้องพัก พื้นที่จัดงาน และสวนที่กำหนดนิยามประสบการณ์ศรีอู่ทองแกรนด์"
    },
    sectionEyebrow: "ภาพถ่าย",
    metaTitleSuffix: "ศรีอู่ทองแกรนด์",
    heroPrimaryLabel: "สำรองที่พัก",
    heroSecondaryLabel: "สำรวจแกลเลอรี",
    openPhotoAria: (label) => `เปิดภาพ ${label}`,
    controlsAria: (label) => `การควบคุมภาพ ${label}`,
    previousPhotoAria: (label) => `ภาพก่อนหน้า ${label}`,
    nextPhotoAria: (label) => `ภาพถัดไป ${label}`,
    closing: {
      eyebrow: "วางแผนการเยี่ยมชม",
      title: "สำรองห้องพักที่ศรีอู่ทองแกรนด์",
      text: "เลือกดูคอลเลกชันห้องพักหรือเปิดหน้าจองเพื่อตรวจสอบห้องว่างและยืนยันการเข้าพัก",
      primaryLabel: "ตรวจสอบห้องว่าง",
      secondaryLabel: "ดูห้องพัก"
    },
    dialogClose: "ปิด",
    dialogCaptionFallback: "ศรีอู่ทองแกรนด์",
    sliderFallbackLabel: "ภาพห้องพัก"
  },
  contact: {
    meta: {
      title: "ติดต่อ | ศรีอู่ทองแกรนด์",
      description: "ติดต่อโรงแรมศรีอู่ทองแกรนด์สำหรับการสำรองห้องพัก การจัดเตรียมอาหาร การวางแผนงาน หรือคำถามใดๆ ทีมงานตอบสนองอย่างรวดเร็ว"
    },
    sectionNav: [
      {
        id: "contact-details",
        label: "ติดต่อ"
      },
      {
        id: "hotel-enquiry",
        label: "สอบถาม"
      }
    ],
    hero: {
      title: "เราพร้อมรับใช้คุณ",
      text: "สำหรับการสอบถามห้องพัก การจองห้องอาหาร การวางแผนงาน หรือคำขอใดๆ — ทีมงานของเราพร้อมให้ความช่วยเหลือเสมอ",
      primaryLabel: `โทร ${sharedSite.phoneDisplay}`,
      secondaryLabel: "ส่งคำถาม"
    },
    details: {
      eyebrow: "ทีมผู้เชี่ยวชาญ",
      title: "พูดคุยกับทีมงานของเรา",
      lead: "ติดต่อเราทางโทรศัพท์หรืออีเมล — เราตอบกลับภายในวันเดียวกัน คุณสามารถติดต่อเราได้ทาง Agoda และ Facebook ด้วย ช่องทาง LINE อย่างเป็นทางการกำลังจะเปิดให้บริการเร็วๆ นี้",
      addressLabel: "ที่อยู่",
      telLabel: "โทร",
      faxLabel: "แฟกซ์",
      emailLabel: "อีเมล"
    },
    form: {
      name: "ชื่อ-นามสกุล *",
      email: "อีเมล",
      phone: "โทรศัพท์ *",
      topic: "ประเภทคำถาม",
      topics: [
        {
          value: "Room booking enquiry",
          label: "สำรองห้องพัก"
        },
        {
          value: "Dining arrangement",
          label: "การจัดเตรียมอาหาร"
        },
        {
          value: "Meeting or event",
          label: "ประชุมหรืองานกิจกรรม"
        },
        {
          value: "General question",
          label: "คำถามทั่วไป"
        }
      ],
      checkin: "วันเข้าพัก",
      checkout: "วันออก",
      guestSummary: "ผู้เข้าพัก",
      guestSummaryPlaceholder: "1 ห้อง, ผู้ใหญ่ 2 ท่าน",
      promoCode: "รหัสโปรโมชัน",
      promoPlaceholder: "ไม่บังคับ — เว้นว่างได้ถ้าไม่มี",
      message: "ข้อความ *",
      messagePlaceholder: "บอกเล่าวันที่ จำนวนผู้เข้าพัก หรือรายละเอียดคำขอของคุณ",
      requiredNotice: "ช่องที่มี * จำเป็นต้องกรอก",
      successNotice: "ขอบคุณ — ได้รับข้อความของคุณแล้ว สมาชิกทีมงานของเราจะติดต่อกลับโดยเร็วที่สุด",
      errorNotice: "ไม่สามารถส่งข้อความของคุณได้ขณะนี้ กรุณาลองอีกครั้ง หรือติดต่อเราโดยตรงทางโทรศัพท์หรืออีเมล",
      submitLabel: "ส่งคำถาม"
    }
  },
  newsIndex: {
    meta: {
      title: "บันทึก | ศรีอู่ทองแกรนด์",
      description: "เรื่องราวของโรงแรม คู่มือท่องเที่ยวสุพรรณบุรี และข้อมูลเชิงลึกที่คัดสรรจากโรงแรมศรีอู่ทองแกรนด์"
    },
    hero: {
      eyebrow: "บันทึก",
      title: "เรื่องเล่าจากเมืองสุพรรณ",
      lead: "ข้อมูลเชิงลึกด้านการท่องเที่ยว ไฮไลท์ด้านอาหาร และคู่มือท้องถิ่น — เขียนขึ้นสำหรับผู้เข้าพักที่ใฝ่รู้และรักการสำรวจ"
    },
    section: {
      eyebrow: "ล่าสุด",
      title: "จากสมุดบันทึก",
      lead: "เรื่องราวและคู่มือใหม่จะปรากฏที่นี่เมื่อเผยแพร่"
    },
    empty: {
      title: "กำลังเตรียมเรื่องราว",
      text: "เรากำลังเขียนบันทึกแรก กลับมาเยี่ยมชมอีกครั้งเร็วๆ นี้เพื่อพบกับคู่มือท่องเที่ยวสุพรรณบุรีและข่าวสารโรงแรม"
    }
  },
  newsArticle: {
    allNews: "ทุกเรื่องราว",
    stayEyebrow: "พักกับเรา",
    stayTitle: "ทำเลที่สะดวกที่สุดในสุพรรณบุรี",
    stayText: "โรงแรมศรีอู่ทองแกรนด์อยู่ใกล้กับแลนด์มาร์คที่มีชื่อเสียงที่สุดของเมือง จองตรงกับโรงแรมเพื่อรับอัตราที่ดีที่สุด",
    stayButton: "จองตรง"
  }
};

function makeThaiTextUnbreakable(obj) {
  if (typeof obj === "string") {
    return obj
      .replaceAll("ศรีอู่ทองแกรนด์โฮเทล", "ศ\u2060ร\u2060ี\u2060อ\u2060ู\u2060่\u2060ท\u2060อ\u2060ง\u2060แ\u2060ก\u2060ร\u2060น\u2060ด\u2060์\u2060โ\u2060ฮ\u2060เ\u2060ท\u2060ล")
      .replaceAll("ศรีอู่ทองแกรนด์", "ศ\u2060ร\u2060ี\u2060อ\u2060ู\u2060่\u2060ท\u2060อ\u2060ง\u2060แ\u2060ก\u2060ร\u2060น\u2060ด\u2060์")
      .replaceAll("ศรีอู่ทอง", "ศ\u2060ร\u2060ี\u2060อ\u2060ู\u2060่\u2060ท\u2060อ\u2060ง");
  }
  if (typeof obj === "function") {
    return (...args) => {
      const res = obj(...args);
      return typeof res === "string" ? makeThaiTextUnbreakable(res) : res;
    };
  }
  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(makeThaiTextUnbreakable);
    }
    const newObj = {};
    for (const [key, val] of Object.entries(obj)) {
      newObj[key] = makeThaiTextUnbreakable(val);
    }
    return newObj;
  }
  return obj;
}

function makeEnglishTextUnbreakable(obj) {
  if (typeof obj === "string") {
    return obj
      .replaceAll("Sri U-Thong Grand", "Sri\u00A0U\u2011Thong\u00A0Grand")
      .replaceAll("Sri U-Thong", "Sri\u00A0U\u2011Thong")
      .replaceAll("U-Thong", "U\u2011Thong");
  }
  if (typeof obj === "function") {
    return (...args) => {
      const res = obj(...args);
      return typeof res === "string" ? makeEnglishTextUnbreakable(res) : res;
    };
  }
  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(makeEnglishTextUnbreakable);
    }
    const newObj = {};
    for (const [key, val] of Object.entries(obj)) {
      newObj[key] = makeEnglishTextUnbreakable(val);
    }
    return newObj;
  }
  return obj;
}

export function getAstroCopy(locale) {
  if (locale === "th") {
    return makeThaiTextUnbreakable(th);
  }
  return makeEnglishTextUnbreakable(en);
}

