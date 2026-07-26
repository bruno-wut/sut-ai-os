"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Images,
  Ruler,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { useLocale } from "@/components/localization/locale-provider";
import type { RoomOption } from "@/lib/booking-data";
import cloudflareLoader from "@/lib/cloudflare-loader";
import { normalizeR2ImageSource } from "@/lib/media";
import { ROOM_AMENITY_GROUPS, ROOM_AMENITY_LABELS } from "@/lib/room-details";

function roomImageProps(src: string) {
  const normalized = src.startsWith("/images/") ? src : normalizeR2ImageSource(src);
  const usesCloudflareImage = normalized.includes("imagedelivery.net") || normalized.includes("/cdn-cgi/image/");
  return { loader: usesCloudflareImage ? cloudflareLoader : undefined, src: normalized };
}

export function RoomDetailsDialog({
  canSelect,
  onOpenChange,
  onSelect,
  open,
  room,
  roomName,
}: Readonly<{
  canSelect: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  open: boolean;
  room: RoomOption;
  roomName: string;
}>) {
  const { dictionary, locale } = useLocale();
  const copy = dictionary.booking;
  const [activeImage, setActiveImage] = useState(0);
  const images = room.galleryImages.slice(0, 8);
  const imageCount = images.length;
  const description = locale === "th" && room.descriptionTh ? room.descriptionTh : room.description;
  const bedConfiguration = locale === "th" && room.bedConfigurationTh
    ? room.bedConfigurationTh
    : room.bedConfiguration;
  const language = locale === "th" ? "th" : "en";

  function changeImage(direction: -1 | 1) {
    if (imageCount <= 1) return;
    setActiveImage((current) => (current + direction + imageCount) % imageCount);
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="room-detail-dialog__overlay" />
        <Dialog.Content className="room-detail-dialog__content">
          <Dialog.Close aria-label={copy.closeRoomDetails} className="room-detail-dialog__close">
            <X aria-hidden="true" size={20} />
          </Dialog.Close>

          <div className="room-detail-gallery">
            <div className="room-detail-gallery__main">
              <Image
                {...roomImageProps(images[activeImage] ?? room.image)}
                alt={`${roomName} — ${copy.roomPhoto} ${activeImage + 1}`}
                fill
                priority
                sizes="(max-width: 820px) 100vw, 62vw"
              />
              {imageCount > 1 ? (
                <>
                  <button
                    aria-label={copy.previousPhoto}
                    className="room-detail-gallery__arrow room-detail-gallery__arrow--previous"
                    onClick={() => changeImage(-1)}
                    type="button"
                  >
                    <ChevronLeft aria-hidden="true" size={22} />
                  </button>
                  <button
                    aria-label={copy.nextPhoto}
                    className="room-detail-gallery__arrow room-detail-gallery__arrow--next"
                    onClick={() => changeImage(1)}
                    type="button"
                  >
                    <ChevronRight aria-hidden="true" size={22} />
                  </button>
                </>
              ) : null}
              <span aria-live="polite" className="room-detail-gallery__count">
                <Images aria-hidden="true" size={14} /> {activeImage + 1} / {imageCount}
              </span>
            </div>

            {imageCount > 1 ? (
              <div aria-label={copy.roomGallery} className="room-detail-gallery__thumbnails">
                {images.map((image, index) => (
                  <button
                    aria-label={`${copy.showPhoto} ${index + 1}`}
                    aria-pressed={activeImage === index}
                    className="room-detail-gallery__thumbnail"
                    key={`${image}-${index}`}
                    onClick={() => setActiveImage(index)}
                    type="button"
                  >
                    <Image
                      {...roomImageProps(image)}
                      alt=""
                      fill
                      sizes="96px"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="room-detail-dialog__panel">
            <div className="room-detail-dialog__scroll">
              <p className="eyebrow">{copy.roomDetails}</p>
              <Dialog.Title>{roomName}</Dialog.Title>
              <Dialog.Description className="room-detail-dialog__description">
                {description}
              </Dialog.Description>

              <div className="room-detail-dialog__key-facts">
                <span><BedDouble aria-hidden="true" size={18} /><strong>{copy.bed}</strong>{bedConfiguration}</span>
                <span><Ruler aria-hidden="true" size={18} /><strong>{copy.roomSize}</strong>{room.sizeSqm} m²</span>
                <span><CircleUserRound aria-hidden="true" size={18} /><strong>{copy.occupancy}</strong>{copy.sleeps(room.maxAdults)}</span>
              </div>

              <section className="room-detail-dialog__policy" aria-labelledby={`extra-bed-${room.slug}`}>
                <h3 id={`extra-bed-${room.slug}`}>{copy.extraBed}</h3>
                <p>{copy.extraBedPolicies[room.extraBedPolicy]}</p>
              </section>

              <div className="room-detail-dialog__amenities">
                <h3>{copy.amenities}</h3>
                {ROOM_AMENITY_GROUPS.map((group) => {
                  const availableAmenities = group.amenities.filter((amenity) => room.amenities.includes(amenity));
                  if (availableAmenities.length === 0) return null;

                  return (
                    <section className="room-detail-amenity-group" key={group.id}>
                      <h4>{group.label[language]}</h4>
                      <ul>
                        {availableAmenities.map((amenity) => (
                          <li key={amenity}>
                            <Check aria-hidden="true" size={15} />
                            {ROOM_AMENITY_LABELS[amenity][language]}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>

            <footer className="room-detail-dialog__footer">
              <p><span>{copy.galleryPhotos}</span><strong>{imageCount} / 8</strong></p>
              <button
                className="button button--primary"
                disabled={!canSelect}
                onClick={onSelect}
                type="button"
              >
                {canSelect ? copy.selectRoom : copy.unavailable}
              </button>
            </footer>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
