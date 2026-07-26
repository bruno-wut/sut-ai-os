import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/components/localization/locale-provider";

import { ConfirmationExperience } from "./confirmation-experience";

function renderConfirmation(reservationNumber: string, tokens: { holdToken?: string; sessionId?: string } = {}) {
  window.history.replaceState(null, "", "/en/confirmation");

  return render(
    <LocaleProvider initialLocale="en">
      <ConfirmationExperience paymentMode="stripe" reservationNumber={reservationNumber} {...tokens} />
    </LocaleProvider>,
  );
}

describe("ConfirmationExperience", () => {
  it("shows live Stripe returns as payment received while final confirmation catches up", () => {
    renderConfirmation("WEB-20300110-00000001", { sessionId: "cs_test_123" });

    expect(screen.getByText("Secure payment received")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reservation received" })).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Confirmation in progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Booking" })).toHaveAttribute(
      "href",
      "/en/lookup?session_id=cs_test_123",
    );
  });

  it("keeps confirmed reservations in the settled platform state", () => {
    renderConfirmation("WEB-20300110-00000001");

    expect(screen.getByRole("heading", { name: "Your stay is confirmed" })).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Confirmation email")).toBeInTheDocument();
  });
});
