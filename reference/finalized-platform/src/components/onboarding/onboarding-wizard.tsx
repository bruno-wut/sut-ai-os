"use client";

import { Check, ChevronLeft, ChevronRight, Hotel, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { initializeHotelInventory, uploadRoomImageToR2 } from "@/app/(staff)/staff/onboarding/actions";
import { SRI_U_THONG_ROOM_PLAN } from "@/lib/hotel-inventory-plan";
import { ROOM_IMAGE_PRESETS } from "@/lib/media";
import {
  defaultRoomDetails,
  MAX_ROOM_GALLERY_IMAGES,
  ROOM_AMENITY_GROUPS,
  ROOM_AMENITY_LABELS,
  type ExtraBedPolicy,
  type RoomAmenityId,
} from "@/lib/room-details";

type RoomTypeDraft = {
  amenities: RoomAmenityId[];
  bedConfiguration: string;
  bedConfigurationTh: string;
  description: string;
  descriptionTh: string;
  extraBedPolicy: ExtraBedPolicy;
  galleryUrls: string[];
  id: number;
  imageUrl: string;
  maxAdults: string;
  name: string;
  rate: string;
  rooms: string;
  sizeSqm: string;
  webRooms: string;
};

function roomDetailsKey(name: string) {
  if (name.startsWith("Classic Room")) return "classic";
  if (name.startsWith("Executive Room")) return "executive";
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const initialRoomTypes: RoomTypeDraft[] = SRI_U_THONG_ROOM_PLAN.map(
  (roomType, index) => {
    const details = defaultRoomDetails(roomDetailsKey(roomType.name), roomType.imageUrl);
    return {
      amenities: [...details.amenities],
      bedConfiguration: details.bedConfiguration,
      bedConfigurationTh: details.bedConfigurationTh,
      description: details.description,
      descriptionTh: details.descriptionTh,
      extraBedPolicy: details.extraBedPolicy,
      galleryUrls: [...details.galleryImages],
      id: index + 1,
      imageUrl: roomType.imageUrl,
      maxAdults: roomDetailsKey(roomType.name) === "deluxe-room" || roomDetailsKey(roomType.name) === "grand-residence" ? "3" : "2",
      name: roomType.name,
      rate: String(roomType.rate),
      rooms: roomType.roomNumbers.join(", "),
      sizeSqm: String(details.sizeSqm),
      webRooms: roomType.websiteRoomNumbers.join(", "),
    };
  },
);

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [roomTypes, setRoomTypes] = useState(initialRoomTypes);
  const [completed, setCompleted] = useState(false);
  const [uploadingRoomId, setUploadingRoomId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [planConfirmed, setPlanConfirmed] = useState(false);

  function updateRoomType<K extends keyof Omit<RoomTypeDraft, "id">>(id: number, field: K, value: RoomTypeDraft[K]) {
    setRoomTypes((types) => types.map((type) => (type.id === id ? { ...type, [field]: value } : type)));
  }

  function updateGallery(id: number, images: string[]) {
    const normalized = Array.from(new Set(images.map((image) => image.trim()).filter(Boolean)))
      .slice(0, MAX_ROOM_GALLERY_IMAGES);
    setRoomTypes((types) => types.map((type) => (
      type.id === id
        ? { ...type, galleryUrls: normalized, imageUrl: normalized[0] ?? type.imageUrl }
        : type
    )));
  }

  async function uploadRoomImages(id: number, files: FileList | undefined) {
    if (!files?.length) return;

    setUploadError(null);
    setUploadingRoomId(id);

    try {
      const currentCount = roomTypes.find((roomType) => roomType.id === id)?.galleryUrls.length ?? 0;
      const availableSlots = Math.max(0, MAX_ROOM_GALLERY_IMAGES - currentCount);
      if (availableSlots === 0) throw new Error(`Each gallery supports up to ${MAX_ROOM_GALLERY_IMAGES} images.`);

      const uploadedUrls: string[] = [];
      for (const file of Array.from(files).slice(0, availableSlots)) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        const result = await uploadRoomImageToR2(uploadData);
        if (!result.ok) throw new Error(result.error);
        uploadedUrls.push(result.url);
      }

      const currentImages = roomTypes.find((roomType) => roomType.id === id)?.galleryUrls ?? [];
      updateGallery(id, [...currentImages, ...uploadedUrls]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Cloudflare image upload failed.");
    } finally {
      setUploadingRoomId(null);
    }
  }

  async function completeSetup() {
    setSetupError(null);
    setIsInitializing(true);

    const result = await initializeHotelInventory(
      roomTypes.map((roomType) => ({
        amenities: roomType.amenities,
        bedConfiguration: roomType.bedConfiguration,
        bedConfigurationTh: roomType.bedConfigurationTh,
        description: roomType.description,
        descriptionTh: roomType.descriptionTh,
        extraBedPolicy: roomType.extraBedPolicy,
        galleryImageUrls: roomType.galleryUrls,
        imageUrl: roomType.imageUrl,
        maxAdults: roomType.maxAdults,
        name: roomType.name,
        rate: roomType.rate,
        roomNumbers: roomType.rooms
          .split(",")
          .map((roomNumber) => roomNumber.trim())
          .filter(Boolean),
        websiteRoomNumbers: roomType.webRooms
          .split(",")
          .map((roomNumber) => roomNumber.trim())
          .filter(Boolean),
        sizeSqm: roomType.sizeSqm,
      })),
    );

    setIsInitializing(false);

    if (!result.ok) {
      setSetupError(result.error);
      return;
    }

    setCompleted(true);
  }

  if (completed) {
    return (
      <section className="setup-complete" aria-live="polite">
        <div className="setup-complete__icon"><Check aria-hidden="true" size={30} /></div>
        <p className="eyebrow">Setup complete</p>
        <h2>Hotel inventory is ready</h2>
        <p>The hotel system created the room types, physical rooms, and protected 365-day inventory calendar.</p>
        <a className="button button--secondary" href="/staff/inventory">Open inventory</a>
      </section>
    );
  }

  return (
    <div className="setup-wizard">
      <ol aria-label="Setup progress" className="setup-steps">
        {["Hotel details", "Rooms & rates", "Review"].map((label, index) => {
          const number = index + 1;
          return <li className={number === step ? "is-current" : number < step ? "is-complete" : ""} key={label}><span>{number < step ? <Check aria-hidden="true" size={14} /> : number}</span><strong>{label}</strong></li>;
        })}
      </ol>

      <section className="setup-panel">
        {step === 1 ? (
          <div>
            <div className="setup-panel__heading"><Hotel aria-hidden="true" size={22} /><div><p className="eyebrow">Step 1 of 3</p><h2>Hotel details</h2></div></div>
            <div className="setup-fields">
              <label className="field setup-fields__wide"><span className="field__label">Hotel name</span><input className="field__control" readOnly value="Sri U-Thong Grand Hotel" /></label>
              <label className="field"><span className="field__label">Timezone</span><input className="field__control" readOnly value="Asia/Bangkok" /></label>
              <label className="field"><span className="field__label">Currency</span><input className="field__control" readOnly value="THB" /></label>
              <label className="field"><span className="field__label">Hotel day rollover</span><input className="field__control" readOnly type="time" value="04:00" /></label>
              <label className="field"><span className="field__label">Inventory horizon</span><div className="field-with-suffix"><input className="field__control" readOnly type="number" value="365" /><span>days</span></div></label>
              <p className="setup-panel__help setup-fields__wide">These operating settings are already secured. This setup creates the room categories, room numbers, images, and starting rates.</p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className="setup-panel__heading"><Hotel aria-hidden="true" size={22} /><div><p className="eyebrow">Step 2 of 3</p><h2>Rooms and base rates</h2></div></div>
            <p className="setup-panel__help">Add each room category, its guest image, normal nightly rate, and the physical room numbers assigned to it.</p>
            {uploadError ? <p className="setup-panel__error" role="alert">{uploadError}</p> : null}
            <div className="room-type-editor">
              {roomTypes.map((type) => (
                <article className="room-type-row" key={type.id}>
                  <div className="room-type-row__basics">
                    <label className="field"><span className="field__label">Room type</span><input className="field__control" onChange={(e) => updateRoomType(type.id, "name", e.target.value)} placeholder="Example: Deluxe Room" value={type.name} /></label>
                    <label className="field"><span className="field__label">Nightly rate</span><div className="field-with-prefix"><span>THB</span><input className="field__control" min="0" onChange={(e) => updateRoomType(type.id, "rate", e.target.value)} placeholder="Example: 1850" type="number" value={type.rate} /></div></label>
                    <label className="field"><span className="field__label">Physical rooms</span><input className="field__control" onChange={(e) => updateRoomType(type.id, "rooms", e.target.value)} placeholder="201, 202, 203" value={type.rooms} /></label>
                    <label className="field"><span className="field__label">Website allocation</span><input className="field__control" onChange={(e) => updateRoomType(type.id, "webRooms", e.target.value)} placeholder="Rooms initially open online" value={type.webRooms} /></label>
                    <button aria-label={`Remove ${type.name || "room type"}`} className="icon-button" disabled={roomTypes.length === 1} onClick={() => setRoomTypes((types) => types.filter((item) => item.id !== type.id))} type="button"><Trash2 aria-hidden="true" size={17} /></button>
                  </div>

                  <details className="room-content-editor">
                    <summary>
                      <span>Guest-facing room details</span>
                      <small>{type.galleryUrls.length}/{MAX_ROOM_GALLERY_IMAGES} images · {type.amenities.length} amenities</small>
                    </summary>
                    <div className="room-content-editor__body">
                      <div className="room-content-editor__grid">
                        <label className="field"><span className="field__label">Room size (m²)</span><input className="field__control" min="1" onChange={(e) => updateRoomType(type.id, "sizeSqm", e.target.value)} type="number" value={type.sizeSqm} /></label>
                        <label className="field"><span className="field__label">Maximum adults</span><input className="field__control" min="1" onChange={(e) => updateRoomType(type.id, "maxAdults", e.target.value)} type="number" value={type.maxAdults} /></label>
                        <label className="field"><span className="field__label">Extra bed policy</span><select className="field__control" onChange={(e) => updateRoomType(type.id, "extraBedPolicy", e.target.value as ExtraBedPolicy)} value={type.extraBedPolicy}><option value="not-available">Not available</option><option value="on-request">Available on request</option><option value="available">Available</option></select></label>
                        <label className="field"><span className="field__label">Bed configuration (English)</span><input className="field__control" onChange={(e) => updateRoomType(type.id, "bedConfiguration", e.target.value)} value={type.bedConfiguration} /></label>
                        <label className="field room-content-editor__wide"><span className="field__label">Bed configuration (Thai)</span><input className="field__control" onChange={(e) => updateRoomType(type.id, "bedConfigurationTh", e.target.value)} value={type.bedConfigurationTh} /></label>
                        <label className="field room-content-editor__wide"><span className="field__label">Full room description (English)</span><textarea className="field__control" onChange={(e) => updateRoomType(type.id, "description", e.target.value)} rows={3} value={type.description} /></label>
                        <label className="field room-content-editor__wide"><span className="field__label">Full room description (Thai)</span><textarea className="field__control" lang="th" onChange={(e) => updateRoomType(type.id, "descriptionTh", e.target.value)} rows={3} value={type.descriptionTh} /></label>
                      </div>

                      <section className="room-gallery-editor">
                        <div>
                          <span className="field__label">Room gallery</span>
                          <p>The first image is the booking-card cover. Use up to eight landscape images, ordered from strongest overview to bathroom and detail views.</p>
                        </div>
                        <label className="field room-image-upload"><span className="field__label">Upload gallery images</span><input accept="image/avif,image/jpeg,image/png,image/webp" className="field__control" disabled={uploadingRoomId === type.id || type.galleryUrls.length >= MAX_ROOM_GALLERY_IMAGES} multiple onChange={(e) => void uploadRoomImages(type.id, e.target.files ?? undefined)} type="file" /><small>{uploadingRoomId === type.id ? "Uploading to R2..." : `${MAX_ROOM_GALLERY_IMAGES - type.galleryUrls.length} image slots available`}</small></label>
                        <label className="field"><span className="field__label">Image URLs — one per line</span><textarea className="field__control" onChange={(e) => updateGallery(type.id, e.target.value.split("\n"))} rows={Math.min(8, Math.max(3, type.galleryUrls.length))} value={type.galleryUrls.join("\n")} /></label>
                      </section>

                      <section className="room-amenity-editor">
                        <div><span className="field__label">Amenities shown to guests</span><p>Select only amenities consistently available in every room of this type.</p></div>
                        <div className="room-amenity-editor__groups">
                          {ROOM_AMENITY_GROUPS.map((group) => (
                            <fieldset key={group.id}>
                              <legend>{group.label.en}</legend>
                              {group.amenities.map((amenity) => (
                                <label key={amenity}>
                                  <input
                                    checked={type.amenities.includes(amenity)}
                                    onChange={(event) => updateRoomType(
                                      type.id,
                                      "amenities",
                                      event.target.checked
                                        ? [...type.amenities, amenity]
                                        : type.amenities.filter((item) => item !== amenity),
                                    )}
                                    type="checkbox"
                                  />
                                  {ROOM_AMENITY_LABELS[amenity].en}
                                </label>
                              ))}
                            </fieldset>
                          ))}
                        </div>
                      </section>
                    </div>
                  </details>
                </article>
              ))}
            </div>
            <button className="button button--secondary" onClick={() => setRoomTypes((types) => {
              const details = defaultRoomDetails("classic", ROOM_IMAGE_PRESETS[0]);
              return [...types, { amenities: [...details.amenities], bedConfiguration: details.bedConfiguration, bedConfigurationTh: details.bedConfigurationTh, description: details.description, descriptionTh: details.descriptionTh, extraBedPolicy: details.extraBedPolicy, galleryUrls: [...details.galleryImages], id: Date.now(), imageUrl: ROOM_IMAGE_PRESETS[0], maxAdults: "2", name: "", rate: "", rooms: "", sizeSqm: String(details.sizeSqm), webRooms: "" }];
            })} type="button"><Plus aria-hidden="true" size={16} />Add room type</button>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="setup-panel__heading"><Check aria-hidden="true" size={22} /><div><p className="eyebrow">Step 3 of 3</p><h2>Review generation plan</h2></div></div>
            <div className="review-summary">
              <div><span>Hotel</span><strong>Sri U-Thong Grand Hotel</strong></div>
              <div><span>Operational calendar</span><strong>Asia/Bangkok - rolls at 04:00</strong></div>
              <div><span>Room types</span><strong>{roomTypes.length}</strong></div>
              <div><span>Gallery images</span><strong>{roomTypes.reduce((total, type) => total + type.galleryUrls.length, 0)}</strong></div>
              <div><span>Amenity profiles</span><strong>{roomTypes.filter((type) => type.amenities.length > 0).length}</strong></div>
              <div><span>Physical rooms</span><strong>{roomTypes.reduce((total, type) => total + type.rooms.split(",").filter(Boolean).length, 0)}</strong></div>
              <div><span>Open for website booking</span><strong>{roomTypes.reduce((total, type) => total + type.webRooms.split(",").filter(Boolean).length, 0)}</strong></div>
              <div><span>Inventory horizon</span><strong>365 days</strong></div>
            </div>
            <div className="preview-notice"><strong>One-time operation</strong><p>Submitting this plan creates the initial room inventory calendar. Review every room number and rate before continuing.</p></div>
            <p className="setup-panel__help">Only the website allocation is opened online. The remaining physical rooms stay Web off for front-desk, group, and operational use. You can adjust daily availability later.</p>
            <label className="field">
              <span className="field__label">
                <input checked={planConfirmed} onChange={(event) => setPlanConfirmed(event.target.checked)} type="checkbox" />
                {" "}I have checked the real room categories, room numbers, and starting rates.
              </span>
            </label>
            {setupError ? <p className="setup-panel__error" role="alert">{setupError}</p> : null}
          </div>
        ) : null}

        <footer className="setup-panel__footer">
          <button className="button button--secondary" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))} type="button"><ChevronLeft aria-hidden="true" size={16} />Back</button>
          {step < 3 ? <button className="button button--primary" onClick={() => setStep((value) => Math.min(3, value + 1))} type="button">Continue<ChevronRight aria-hidden="true" size={16} /></button> : <button className="button button--primary" disabled={isInitializing || !planConfirmed} onClick={() => void completeSetup()} type="button">{isInitializing ? "Generating inventory..." : "Generate inventory"}<Check aria-hidden="true" size={16} /></button>}
        </footer>
      </section>
    </div>
  );
}
