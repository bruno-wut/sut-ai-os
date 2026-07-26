import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/localization/locale-provider";
import type { RoomOption } from "@/lib/booking-data";

import { RoomDetailsDialog } from "./room-details-dialog";

const room: RoomOption = {
  amenities: ["air-conditioning", "in-room-wifi", "private-bathroom"],
  bedConfiguration: "One king bed",
  bedConfigurationTh: "เตียงคิงไซส์ 1 เตียง",
  description: "A complete room description for gallery interaction testing.",
  descriptionTh: "รายละเอียดห้องพักสำหรับทดสอบการใช้งานแกลเลอรี",
  extraBedPolicy: "on-request",
  features: ["King bed", "Breakfast included"],
  galleryImages: ["/images/grand-superior-room.jpg", "/images/grand-deluxe-room.jpg"],
  image: "/images/grand-superior-room.jpg",
  isAvailable: true,
  maxAdults: 2,
  name: "Test Room",
  nightlyPrice: 1_200,
  roomsLeft: 2,
  size: "32 m²",
  sizeSqm: 32,
  sleeps: 2,
  slug: "test-room",
  source: "fixture",
  summary: "A test room.",
};

function renderDialog(onSelect = vi.fn()) {
  return render(
    <LocaleProvider initialLocale="en">
      <RoomDetailsDialog
        canSelect
        onOpenChange={vi.fn()}
        onSelect={onSelect}
        open
        room={room}
        roomName="Test Room"
      />
    </LocaleProvider>,
  );
}

describe("RoomDetailsDialog", () => {
  it("groups amenities and moves through the gallery", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Test Room" })).toBeInTheDocument();
    expect(screen.getByAltText("Test Room — room photo 1")).toBeInTheDocument();
    expect(screen.getByText("Complimentary Wi-Fi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));

    expect(screen.getByAltText("Test Room — room photo 2")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("passes selection back to the booking experience", () => {
    const onSelect = vi.fn();
    renderDialog(onSelect);

    fireEvent.click(screen.getByRole("button", { name: "Select this room" }));

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
