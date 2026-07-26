"use client";

import { BedDouble, Check, Images, Ruler, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useRouter } from "next/navigation";

import { useLocale } from "@/components/localization/locale-provider";
import { RoomDetailsDialog } from "@/components/booking/room-details-dialog";
import type { RoomOption } from "@/lib/booking-data";
import cloudflareLoader from "@/lib/cloudflare-loader";
import { getR2MediaDomain, normalizeR2ImageSource } from "@/lib/media";
import { formatThaiBaht } from "@/lib/fixtures";
import { addDaysToDateString, formatDisplayDate, getBangkokDateString, normalizeStayDates } from "@/lib/hotel-dates";
import { localizePath } from "@/lib/i18n/config";

type SearchState = Readonly<{
  adults: string;
  checkIn: string;
  checkOut: string;
  children: string;
  promoCode: string;
  rooms: string;
}>;

type LocalizedRoomCategory = Readonly<{
  features: readonly string[];
  name: string;
  summary: string;
}>;

function roomCategoryKey(room: RoomOption) {
  if (room.slug === "classic") return "classic";
  if (room.slug === "executive") return "executive";
  if (room.name === "Deluxe Room") return "deluxe-room";
  if (room.name === "Studio Suite") return "studio-suite";
  if (room.name === "Executive Suite") return "executive-suite";
  if (room.name === "Grand Residence") return "grand-residence";
  return room.slug;
}

function localizedRoomCategory(
  room: RoomOption,
  categories: Record<string, LocalizedRoomCategory>,
) {
  return categories[roomCategoryKey(room)] ?? room;
}

function rawR2FallbackForImage(src: string) {
  const normalized = normalizeR2ImageSource(src);
  return normalized.startsWith(`https://${getR2MediaDomain()}/library/images/`) ? normalized : null;
}

function getNightCount(checkIn: string, checkOut: string) {
  return Math.max(1, (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
}

export function BookingExperience({ initialSearch = {}, rooms, suggestion }: Readonly<{
  initialSearch?: Partial<SearchState>;
  rooms: readonly RoomOption[];
  suggestion?: { message: string; targetRooms: number } | null;
}>) {
  const { dictionary, locale } = useLocale();
  const router = useRouter();
  const copy = dictionary.booking;
  const initialStayDates = normalizeStayDates(initialSearch.checkIn, initialSearch.checkOut);
  const [searched] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [activeDetailsRoom, setActiveDetailsRoom] = useState<RoomOption | null>(null);
  const [imageFallbacks, setImageFallbacks] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState<SearchState>({
    adults: initialSearch.adults ?? "2",
    checkIn: initialStayDates.checkIn,
    checkOut: initialStayDates.checkOut,
    children: initialSearch.children ?? "0",
    promoCode: initialSearch.promoCode ?? "",
    rooms: initialSearch.rooms ?? "1",
  });

  const selected = rooms.find((room) => room.slug === selectedRoom);
  const activeDetailsCategory = activeDetailsRoom
    ? localizedRoomCategory(
        activeDetailsRoom,
        dictionary.booking.categories as Record<string, LocalizedRoomCategory>,
      )
    : null;
  const nightCount = getNightCount(initialStayDates.checkIn, initialStayDates.checkOut);
  const sourceLabel = rooms.some((room) => room.source === "supabase")
    ? copy.liveAvailability
    : copy.availableRoomTypes;

  function scarcityLabel(count: number) {
    if (count <= 0) return copy.availZero;
    if (count <= 3) return copy.availLow(count);
    if (count <= 5) return copy.availMed;
    return copy.availHigh;
  }

  const handleCheckInChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCheckIn = e.target.value;
    setSearch((prev) => {
      let newCheckOut = prev.checkOut;
      if (newCheckOut <= newCheckIn) {
        newCheckOut = addDaysToDateString(newCheckIn, 1);
      }
      return { ...prev, checkIn: newCheckIn, checkOut: newCheckOut };
    });
  };

  const handleCheckOutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCheckOut = e.target.value;
    setSearch((prev) => ({ ...prev, checkOut: newCheckOut }));
  };

  return (
    <>
      <section aria-labelledby="booking-title" className="guest-hero guest-hero--compact">
        <Image
          alt="Sri U-Thong Grand Hotel exterior in Suphanburi"
          className="guest-hero__image"
          fill
          priority
          sizes="100vw"
          src="/images/grand-exterior.jpg"
        />
        <div className="guest-hero__content">
          <p className="eyebrow">{copy.location}</p>
          <h1 className="display-title guest-hero__title" id="booking-title">
            {copy.title}
          </h1>
          <p className="guest-hero__lead">
            {copy.lead}
          </p>
        </div>
      </section>

      <section aria-labelledby="search-title" className="booking-panel-wrap">
        <div className="booking-panel">
          <div className="booking-panel__intro">
            <div>
              <div className="preview-kicker">{sourceLabel}</div>
              <h2 className="booking-panel__title" id="search-title">
                {copy.plan}
              </h2>
            </div>
            <p className="booking-panel__note" role="status">
              {copy.dateNote}
            </p>
          </div>
          <form
            className="booking-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const stayDates = normalizeStayDates(
                String(formData.get("checkIn") ?? ""),
                String(formData.get("checkOut") ?? ""),
              );

              const checkIn = stayDates.checkIn;
              const checkOut = stayDates.checkOut;
              const roomsParam = String(formData.get("rooms") ?? "1");
              const adults = String(formData.get("adults") ?? "2");

              // Trigger client-side navigation to refresh query params & server components
              const url = `/book?checkIn=${checkIn}&checkOut=${checkOut}&rooms=${roomsParam}&adults=${adults}`;
              router.push(localizePath(url, locale));
            }}
          >
            <label className="field" htmlFor="booking-check-in">
              <span className="field__label">{copy.checkIn}</span>
              <input
                className="field__control"
                id="booking-check-in"
                min={getBangkokDateString()}
                name="checkIn"
                onChange={handleCheckInChange}
                required
                type="date"
                value={search.checkIn}
              />
            </label>
            <label className="field" htmlFor="booking-check-out">
              <span className="field__label">{copy.checkOut}</span>
              <input
                className="field__control"
                id="booking-check-out"
                min={addDaysToDateString(search.checkIn, 1)}
                name="checkOut"
                onChange={handleCheckOutChange}
                required
                type="date"
                value={search.checkOut}
              />
            </label>
            <label className="field" htmlFor="booking-rooms">
              <span className="field__label">{copy.rooms}</span>
              <select
                className="field__control"
                defaultValue={search.rooms}
                id="booking-rooms"
                name="rooms"
                onChange={(e) => setSearch((prev) => ({ ...prev, rooms: e.target.value }))}
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>{count} {count === 1 ? copy.room : copy.roomPlural}</option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="booking-adults">
              <span className="field__label">{copy.guests}</span>
              <select
                className="field__control"
                defaultValue={search.adults}
                id="booking-adults"
                name="adults"
                onChange={(e) => setSearch((prev) => ({ ...prev, adults: e.target.value }))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count} value={count}>{count} {count === 1 ? copy.adult : copy.adults}</option>
                ))}
              </select>
            </label>
            <button className="button button--primary" type="submit">{copy.checkAvailability}</button>
          </form>
        </div>
      </section>

      {searched ? (
        <section aria-labelledby="rooms-heading" className="room-results">
          <header className="room-results__header">
            <div>
              <p className="eyebrow">{initialStayDates.checkIn} to {initialStayDates.checkOut} - {nightCount} {nightCount === 1 ? "night" : "nights"}</p>
              <h2 id="rooms-heading">{copy.chooseRoom}</h2>
            </div>
            <p>{copy.availableRoomTypes}</p>
          </header>

          {suggestion && (
            <div style={{ backgroundColor: "var(--color-stone-100, #f5f5f4)", padding: "1rem", borderLeft: "4px solid var(--color-stone-800, #292524)", margin: "1.5rem 0" }}>
              <p style={{ color: "var(--color-stone-800, #292524)", margin: 0 }}>
                {suggestion.message}
              </p>
              <button 
                onClick={() => {
                  const url = `/book?checkIn=${search.checkIn}&checkOut=${search.checkOut}&rooms=${suggestion.targetRooms}&adults=${search.adults}&children=${search.children}&promoCode=${encodeURIComponent(search.promoCode)}`;
                  router.push(localizePath(url, locale));
                }}
                style={{ marginTop: "0.5rem", fontSize: "0.875rem", fontWeight: "bold", textDecoration: "underline", textUnderlineOffset: "4px", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", color: "inherit" }}
              >
                Update search to {suggestion.targetRooms} rooms
              </button>
            </div>
          )}

          <div className="room-list">
            {rooms.map((room) => {
              const isSelected = room.slug === selectedRoom;
              const rawImageFallback = room.source === "fixture" ? null : rawR2FallbackForImage(room.image);
              const normalizedImage = room.source === "fixture" ? room.image : rawImageFallback || room.image;
              const imageSrc = imageFallbacks[room.slug] && rawImageFallback ? rawImageFallback : normalizedImage;
              const usesCloudflareImage = imageSrc.includes("imagedelivery.net") || imageSrc.includes("/cdn-cgi/image/");
              const localizedRoom = localizedRoomCategory(
                room,
                dictionary.booking.categories as Record<string, LocalizedRoomCategory>,
              );
              const roomName = localizedRoom.name || room.name;
              const roomSummary = localizedRoom.summary || room.summary;
              const roomFeatures = localizedRoom.features || room.features;
              return (
                <article className={`room-card${isSelected ? " room-card--selected" : ""}`} key={room.slug}>
                  <div className="room-card__media">
                    <Image
                      alt={room.name}
                      fill
                      loader={usesCloudflareImage ? cloudflareLoader : undefined}
                      onError={() => {
                        if (rawImageFallback && !imageFallbacks[room.slug]) {
                          setImageFallbacks((current) => ({ ...current, [room.slug]: true }));
                        }
                      }}
                      sizes="(max-width: 780px) 100vw, 38vw"
                      src={imageSrc}
                      unoptimized={Boolean(imageFallbacks[room.slug])}
                    />
                  </div>
                  <div className="room-card__body">
                    <div>
                      <span className="preview-kicker">{copy.availableRoomTypes}</span>
                      <h3>{roomName}</h3>
                      <p className="room-card__summary">{roomSummary}</p>
                      <div className="room-card__facts">
                        <span><Users aria-hidden="true" size={16} /> {copy.sleeps(room.sleeps)}</span>
                        <span><Ruler aria-hidden="true" size={16} /> {room.size}</span>
                        <span><BedDouble aria-hidden="true" size={16} /> {roomFeatures[0]}</span>
                      </div>
                      <ul className="room-card__features">
                        {roomFeatures.slice(1).map((feature: string) => <li key={feature}><Check aria-hidden="true" size={14} />{feature}</li>)}
                      </ul>
                      <button
                        className="room-card__details-button"
                        onClick={() => setActiveDetailsRoom(room)}
                        type="button"
                      >
                        <Images aria-hidden="true" size={16} />
                        {copy.roomDetails}
                        <span>{copy.photoCount(room.galleryImages.length)}</span>
                      </button>
                    </div>
                  </div>
                  <div className="room-card__rate">
                    <span className="room-card__scarcity">{scarcityLabel(room.roomsLeft)}</span>
                    <p><strong>{formatThaiBaht(room.nightlyPrice * nightCount)}</strong><span>{copy.nightTotal(nightCount)}</span></p>
                    <small>{formatThaiBaht(room.nightlyPrice)} {copy.perNight}</small>
                    
                    {room.notAvailableReason === 'CAPACITY_EXCEEDED' ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "0.5rem", textAlign: "right" }}>
                        <span style={{ fontWeight: 500, color: "var(--color-stone-500, #78716c)", letterSpacing: "0.025em" }}>
                          {copy.exceedCapacity}
                        </span>
                        
                        <span style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "var(--color-stone-400, #a8a29e)" }}>
                          {locale === 'th' 
                            ? `รองรับสูงสุด ${room.maxAdults} ท่านต่อห้อง` 
                            : `Maximum ${room.maxAdults} adults per room`}
                        </span>
                        
                        <button 
                          onClick={() => {
                            const newRoomCount = (Number.parseInt(search.rooms, 10) || 1) + 1;
                            const url = `/book?checkIn=${search.checkIn}&checkOut=${search.checkOut}&rooms=${newRoomCount}&adults=${search.adults}&children=${search.children}&promoCode=${encodeURIComponent(search.promoCode)}`;
                            router.push(localizePath(url, locale));
                          }}
                          style={{ marginTop: "0.75rem", fontSize: "0.875rem", textDecoration: "underline", textUnderlineOffset: "4px", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", color: "var(--color-stone-600, #57534e)" }}
                        >
                          {copy.addRoomToStay}
                        </button>
                      </div>
                    ) : room.notAvailableReason === 'SOLD_OUT' || room.roomsLeft <= 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "0.5rem" }}>
                        <span style={{ fontWeight: 500, color: "var(--color-stone-500, #78716c)" }}>
                          {copy.availZero}
                        </span>
                        
                        {room.nextAvailableDate && (
                          <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--color-stone-400, #a8a29e)", textAlign: "right" }}>
                            <p>Available starting {formatDisplayDate(room.nextAvailableDate)}</p>
                            <button 
                              onClick={() => {
                                const newCheckIn = room.nextAvailableDate;
                                const newCheckOut = addDaysToDateString(newCheckIn!, nightCount);
                                router.push(localizePath(`/book?checkIn=${newCheckIn}&checkOut=${newCheckOut}&rooms=${search.rooms}&adults=${search.adults}&children=${search.children}&promoCode=${encodeURIComponent(search.promoCode)}`, locale));
                              }} 
                              style={{ textDecoration: "underline", textUnderlineOffset: "4px", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", color: "inherit" }}
                            >
                              {copy.shiftDates}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        aria-pressed={isSelected}
                        className={`button ${isSelected ? "button--secondary" : "button--primary"}`}
                        onClick={() => setSelectedRoom(isSelected ? null : room.slug)}
                        type="button"
                      >
                        {isSelected ? copy.selected : copy.selectRoom}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {activeDetailsRoom && activeDetailsCategory ? (
            <RoomDetailsDialog
              canSelect={activeDetailsRoom.isAvailable && activeDetailsRoom.roomsLeft > 0}
              key={activeDetailsRoom.slug}
              onOpenChange={(open) => {
                if (!open) setActiveDetailsRoom(null);
              }}
              onSelect={() => {
                setSelectedRoom(activeDetailsRoom.slug);
                setActiveDetailsRoom(null);
              }}
              open
              room={activeDetailsRoom}
              roomName={activeDetailsCategory.name || activeDetailsRoom.name}
            />
          ) : null}
        </section>
      ) : null}

      {selected ? (
        <aside aria-label={copy.selectedRoomSummary} className="selection-bar">
          <div>
            <span>{copy.selected}</span>
            <strong>{selected.name}</strong>
          </div>
          <div>
            <span>{copy.stayTotal}</span>
            <strong>{formatThaiBaht(selected.nightlyPrice * nightCount)}</strong>
          </div>
          <Link className="button button--primary" href={localizePath(`/checkout?room=${selected.slug}&checkIn=${initialStayDates.checkIn}&checkOut=${initialStayDates.checkOut}&rooms=${search.rooms}&adults=${search.adults}&children=${search.children}&promoCode=${encodeURIComponent(search.promoCode)}`, locale)}>
            {copy.continueCheckout}
          </Link>
        </aside>
      ) : null}
    </>
  );
}
