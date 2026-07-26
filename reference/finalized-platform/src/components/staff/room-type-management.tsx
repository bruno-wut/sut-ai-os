"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus, Link2, Save, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { saveRoomTypeConfiguration } from "@/app/(staff)/staff/room-types/actions";
import { MAX_ROOM_GALLERY_IMAGES, ROOM_AMENITY_GROUPS, ROOM_AMENITY_LABELS, type ExtraBedPolicy, type RoomAmenityId } from "@/lib/room-details";
import type { StaffRoomTypeConfiguration } from "@/lib/staff-room-type-data";

type GalleryItem =
  | { id: string; kind: "existing"; url: string }
  | { file: File; id: string; kind: "upload"; token: string };

function initialGallery(urls: string[]): GalleryItem[] {
  return urls.map((url, index) => ({ id: `${index}-${url}`, kind: "existing", url }));
}

function RoomTypeEditor({ roomType }: Readonly<{ roomType: StaffRoomTypeConfiguration }>) {
  const [amenities, setAmenities] = useState<RoomAmenityId[]>(roomType.amenities);
  const [bedConfiguration, setBedConfiguration] = useState(roomType.bedConfiguration);
  const [bedConfigurationTh, setBedConfigurationTh] = useState(roomType.bedConfigurationTh);
  const [description, setDescription] = useState(roomType.description);
  const [descriptionTh, setDescriptionTh] = useState(roomType.descriptionTh);
  const [extraBedPolicy, setExtraBedPolicy] = useState<ExtraBedPolicy>(roomType.extraBedPolicy);
  const [gallery, setGallery] = useState<GalleryItem[]>(() => initialGallery(roomType.galleryImageUrls));
  const [maxAdults, setMaxAdults] = useState(String(roomType.maxAdults));
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [sizeSqm, setSizeSqm] = useState(String(roomType.sizeSqm));
  const [websiteRoomNumbers, setWebsiteRoomNumbers] = useState(() => new Set(
    roomType.physicalRooms.filter((room) => room.webAllocationEnabled).map((room) => room.number),
  ));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  function toggleAmenity(amenity: RoomAmenityId, checked: boolean) {
    setAmenities((current) => checked ? [...current, amenity] : current.filter((item) => item !== amenity));
  }

  function queueImages(files: FileList | null) {
    if (!files?.length) return;
    const available = MAX_ROOM_GALLERY_IMAGES - gallery.length;
    const queued = Array.from(files).slice(0, available).map((file) => {
      const token = crypto.randomUUID().replaceAll("-", "");
      return { file, id: token, kind: "upload" as const, token };
    });
    setGallery((current) => [...current, ...queued]);
    setMessage(null);
  }

  function moveImage(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= gallery.length) return;
    setGallery((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setMessage(null);
  }

  function addCanonicalImageUrl() {
    const url = imageUrlDraft.trim();
    if (!/^https:\/\/[^/]+\/library\/images\/[A-Za-z0-9._/-]+$/.test(url)) {
      setMessage({ kind: "error", text: "Enter a canonical HTTPS URL under /library/images/." });
      return;
    }
    if (gallery.some((item) => item.kind === "existing" && item.url === url)) {
      setMessage({ kind: "error", text: "That image is already in this gallery." });
      return;
    }
    if (gallery.length >= MAX_ROOM_GALLERY_IMAGES) return;
    setGallery((current) => [...current, { id: url, kind: "existing", url }]);
    setImageUrlDraft("");
    setMessage(null);
  }

  async function publish() {
    setMessage(null);
    setSaving(true);

    const formData = new FormData();
    formData.set("configuration", JSON.stringify({
      amenities,
      bedConfiguration,
      bedConfigurationTh,
      description,
      descriptionTh,
      extraBedPolicy,
      gallery: gallery.map((item) => item.kind === "existing"
        ? { kind: item.kind, url: item.url }
        : { kind: item.kind, token: item.token }),
      maxAdults,
      roomTypeId: roomType.id,
      sizeSqm,
      websiteRoomNumbers: Array.from(websiteRoomNumbers),
    }));
    for (const item of gallery) {
      if (item.kind === "upload") formData.set(`upload:${item.token}`, item.file);
    }

    const result = await saveRoomTypeConfiguration(formData);
    setSaving(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }

    setGallery(initialGallery(result.data.galleryImageUrls));
    setMessage({ kind: "success", text: "Published. Staff inventory and the guest booking page now use this room configuration." });
  }

  return (
    <article className="room-management-card">
      <header className="room-management-card__header">
        <div>
          <p className="eyebrow">{roomType.code}</p>
          <h2>{roomType.name}</h2>
          <p>THB {roomType.baseNightlyRate.toLocaleString("en-US")} base rate · {roomType.physicalRooms.length} physical rooms</p>
        </div>
        <div className="room-management-card__status">
          <strong>{websiteRoomNumbers.size}</strong>
          <span>rooms open to website</span>
        </div>
      </header>

      <div className="room-management-card__body">
        <section className="room-management-section">
          <div className="room-management-section__heading">
            <div><span className="field__label">Guest gallery</span><p>Up to eight landscape images. The first image becomes the booking-card cover.</p></div>
            <label className="button button--secondary room-management-upload">
              <ImagePlus aria-hidden="true" size={16} />
              Add images
              <input
                accept="image/avif,image/jpeg,image/png,image/webp"
                disabled={gallery.length >= MAX_ROOM_GALLERY_IMAGES || saving}
                multiple
                onChange={(event) => { queueImages(event.target.files); event.currentTarget.value = ""; }}
                type="file"
              />
            </label>
          </div>
          <p className="room-management-upload-note">New files remain on this device until Publish. Failed or abandoned edits create no R2 objects.</p>
          <div className="room-management-url-row">
            <label className="field"><span className="field__label">Add canonical R2 image URL</span><input className="field__control" disabled={gallery.length >= MAX_ROOM_GALLERY_IMAGES || saving} onChange={(event) => setImageUrlDraft(event.target.value)} placeholder="https://assets.sriuthonghotels.com/library/images/rooms/..." type="url" value={imageUrlDraft} /></label>
            <button className="button button--secondary" disabled={!imageUrlDraft.trim() || gallery.length >= MAX_ROOM_GALLERY_IMAGES || saving} onClick={addCanonicalImageUrl} type="button"><Link2 aria-hidden="true" size={16} />Add URL</button>
          </div>
          <div className="room-management-gallery">
            {gallery.map((item, index) => (
              <div className="room-management-gallery__item" key={item.id}>
                {item.kind === "existing"
                  ? <Image alt={`${roomType.name} gallery image ${index + 1}`} height={360} src={item.url} width={480} />
                  : <div className="room-management-gallery__pending"><ImagePlus aria-hidden="true" size={22} /><span>{item.file.name}</span><small>Queued</small></div>}
                <div className="room-management-gallery__meta">
                  <strong>{index === 0 ? "Cover" : `Photo ${index + 1}`}</strong>
                  <span>{gallery.length}/{MAX_ROOM_GALLERY_IMAGES}</span>
                </div>
                <div className="room-management-gallery__actions">
                  <button aria-label={`Move image ${index + 1} left`} disabled={index === 0 || saving} onClick={() => moveImage(index, -1)} type="button"><ArrowLeft aria-hidden="true" size={14} /></button>
                  <button aria-label={`Move image ${index + 1} right`} disabled={index === gallery.length - 1 || saving} onClick={() => moveImage(index, 1)} type="button"><ArrowRight aria-hidden="true" size={14} /></button>
                  <button aria-label={`Remove image ${index + 1}`} disabled={gallery.length === 1 || saving} onClick={() => setGallery((current) => current.filter((entry) => entry.id !== item.id))} type="button"><X aria-hidden="true" size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="room-management-section">
          <div className="room-content-editor__grid">
            <label className="field"><span className="field__label">Room size (m²)</span><input className="field__control" min="1" onChange={(event) => setSizeSqm(event.target.value)} type="number" value={sizeSqm} /></label>
            <label className="field"><span className="field__label">Maximum adults</span><input className="field__control" min="1" onChange={(event) => setMaxAdults(event.target.value)} type="number" value={maxAdults} /></label>
            <label className="field"><span className="field__label">Extra bed policy</span><select className="field__control" onChange={(event) => setExtraBedPolicy(event.target.value as ExtraBedPolicy)} value={extraBedPolicy}><option value="not-available">Not available</option><option value="on-request">Available on request</option><option value="available">Available</option></select></label>
            <label className="field"><span className="field__label">Bed configuration (English)</span><input className="field__control" maxLength={160} onChange={(event) => setBedConfiguration(event.target.value)} value={bedConfiguration} /></label>
            <label className="field room-content-editor__wide"><span className="field__label">Bed configuration (Thai)</span><input className="field__control" lang="th" maxLength={160} onChange={(event) => setBedConfigurationTh(event.target.value)} value={bedConfigurationTh} /></label>
            <label className="field room-content-editor__wide"><span className="field__label">Full room description (English)</span><textarea className="field__control" maxLength={1500} minLength={20} onChange={(event) => setDescription(event.target.value)} rows={4} value={description} /></label>
            <label className="field room-content-editor__wide"><span className="field__label">Full room description (Thai)</span><textarea className="field__control" lang="th" maxLength={1500} onChange={(event) => setDescriptionTh(event.target.value)} rows={4} value={descriptionTh} /></label>
          </div>
        </section>

        <section className="room-management-section">
          <div><span className="field__label">Amenities shown to guests</span><p>Select amenities consistently available in every room of this type.</p></div>
          <div className="room-amenity-editor__groups">
            {ROOM_AMENITY_GROUPS.map((group) => (
              <fieldset key={group.id}>
                <legend>{group.label.en}</legend>
                {group.amenities.map((amenity) => (
                  <label key={amenity}><input checked={amenities.includes(amenity)} onChange={(event) => toggleAmenity(amenity, event.target.checked)} type="checkbox" />{ROOM_AMENITY_LABELS[amenity].en}</label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>

        <section className="room-management-section">
          <div><span className="field__label">Website room allocation</span><p>Only selected physical rooms are offered on the guest booking page. Existing bookings remain protected.</p></div>
          <div className="room-allocation-grid">
            {roomType.physicalRooms.map((room) => (
              <label className={websiteRoomNumbers.has(room.number) ? "is-selected" : ""} key={room.id}>
                <input
                  checked={websiteRoomNumbers.has(room.number)}
                  onChange={(event) => setWebsiteRoomNumbers((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(room.number); else next.delete(room.number);
                    return next;
                  })}
                  type="checkbox"
                />
                <span>{room.number}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <footer className="room-management-card__footer">
        <div aria-live="polite">
          {message ? <p className={`room-management-message room-management-message--${message.kind}`}><Check aria-hidden="true" size={15} />{message.text}</p> : <p>Publish updates room details and allocation together in one audited operation.</p>}
        </div>
        <button className="button button--primary" disabled={saving || gallery.length === 0 || amenities.length === 0} onClick={() => void publish()} type="button"><Save aria-hidden="true" size={16} />{saving ? "Publishing..." : "Publish room"}</button>
      </footer>
    </article>
  );
}

export function RoomTypeManagement({ roomTypes }: Readonly<{ roomTypes: StaffRoomTypeConfiguration[] }>) {
  if (!roomTypes.length) return <section className="staff-panel table-empty">No active room types are available.</section>;
  return <div className="room-management-list">{roomTypes.map((roomType) => <RoomTypeEditor key={roomType.id} roomType={roomType} />)}</div>;
}
