# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Project Name: Hotel Inventory Bridge (Custom IBE & Staff Dashboard)
## Target Architecture: Next.js/React frontend, Supabase database, Stripe API payments plus pay-at-hotel settlement, Resend/SendGrid for email.

---

## 1. Executive Summary & Core Concept
This system serves as an allotment-based Internet Booking Engine (IBE) and an internal Staff Dashboard. Because it does not directly sync with the property's external legacy PMS via API, it uses an "Allotment Ledger" design. The system uses strict consecutive-stay logic and an automated "human-in-the-loop" notification architecture to completely eliminate overbookings while keeping operational friction low.

---

## 2. Database Architecture (Supabase Schema)

### Table: `physical_room_allotments`
Tracks inventory and availability at the individual physical room level per calendar date.
* `id` (UUID, Primary Key)
* `date` (Date, Required)
* `room_number` (Text, Required)
* `room_type` (Text, Required - e.g., 'Deluxe', 'Suite')
* `nightly_price` (Numeric/Decimal, Required)
* `is_available` (Boolean, Default: true) - *Staff toggle to put online/offline*
* `is_booked` (Boolean, Default: false) - *Turns true upon successful payment*
* `hold_expires_at` (Timestamp, Nullable) - *Used for temporary payment locks*
* *Constraint:* Unique composite index on (`date`, `room_number`) to prevent duplicate data layers.

### Table: `web_reservations`
Stores guest and reservation metadata once paid.
* `id` (UUID, Primary Key)
* `stripe_session_id` (Text, Unique)
* `guest_name`, `guest_email`, `guest_phone` (Text)
* `check_in_date`, `check_out_date` (Date)
* `room_type` (Text)
* `assigned_room_numbers` (Array of Text) - *Supports multi-room bookings*
* `total_paid` (Numeric)
* `sync_status` (Enum: 'Pending', 'Synced', 'Cancelled') - *Default: 'Pending'*
* `created_at` (Timestamp)
* `payment_mode` (Enum: `stripe`, `pay_at_hotel`) - *Independent settlement path; existing reservations default to Stripe.*
* `payment_status` (Enum: `not_collected`, `collected`, `refunded`) - *Independent from PMS synchronization.*
* `amount_due` (Numeric) - *Outstanding hotel balance; zero after collection.*
* `stripe_session_id`, `stripe_payment_intent_id` are nullable only for non-Stripe reservations.

---

## 3. Core Business Logic & Edge Case Constraints

### Rule A: Dynamic Defragmentation Logic (The "Hotel Tetris" Fix)
When a guest searches for a multi-night stay, the IBE backend must verify inventory via a two-tier process:
1. **Total Capacity Check:** Ensure that for *every single night* in the selected date range, total available rooms (`is_available = true` AND `is_booked = false`) for that category is >= the requested quantity.
2. **Consecutive Stay Optimization:** Check if specific physical room numbers are vacant for the entire consecutive duration.
3. **The Shuffle Algorithm:** If Step 1 passes but Step 2 fails, the system must simulate moving an existing, unarrived guest booking to a different vacant room. If this shuffle clears a straight, consecutive timeline for the new guest, **approve the booking**. 
4. **Staff Reporting:** Flag this booking on the dashboard as "Room Shuffle Required" and output explicit step-by-step room migration instructions for the staff.

### Rule B: The "Abandoned Cart" Inventory Lock
1. When a guest clicks "Proceed to Payment," the database updates the selected room's `hold_expires_at` timestamp to exactly 15 minutes into the future.
2. During this 15-minute window, this room is treated as unavailable to other web searches.
3. If a Stripe webhook payment confirmation is received, `is_booked` turns `true` and `hold_expires_at` is cleared.
4. If the 15-minute window expires without a payment webhook, a background cron job/database trigger automatically releases the hold (`hold_expires_at = null`).

### Rule C: 4:00 AM Hotel Day Rollover
1. The operational calendar day rolls over at **4:00 AM**, not midnight.
2. If a guest uses the IBE between Midnight and 4:00 AM, display a prominent modal alert: *"Notice: You are booking for check-in at 3:00 PM later today. If you need a room to check-in right now, please select yesterday's date or contact the front desk."*

### Rule D: Multi-Room Allocation Array
The IBE shopping cart must allow a user to book multiple rooms of the same category in a single transaction. The backend database check must process this as an array request, ensuring it isolates and locks *distinct* physical room sequences simultaneously without overlapping.

---

## 4. Interfaces & User Workflows

### Interface 1: First-Time Onboarding Configuration (System Setup)
* **Behavior:** If the `physical_room_allotments` table is empty upon staff login, intercept the route and display a setup wizard.
* **Inputs:** Allow staff to define a list of Room Types, base nightly rates, and assign specific physical room numbers to those types.
* **Execution:** On submission, a background function bulk-generates calendar entries for the next 365 days using these baselines.

### Interface 2: Public Guest-Facing IBE
* **Price Calculation:** Dynamically reads the individual price array for each specific night and displays the mathematical sum.
* **Payment Choice:** Supports Stripe Hosted Checkout or a pay-at-hotel booking. Booking/PMS confirmation and payment collection remain separate states.
* **Confirmation States:** Upon payment success, immediately displays an on-screen notice and fires an automated transactional email explicitly stating: *"Reservation Received & Processing (Awaiting PMS Confirmation)."*

### Interface 3: Internal Staff Dashboard
* **Inventory & Pricing Control Grid:** A spreadsheet-style visual calendar allowing staff to view and modify allocations day-by-day or via bulk updates. Contains a "Panic Button" to instantly wipe out all web availability for a selected day.
* **The "Human API" Synced Hub:** Displays all web bookings. Provides a large button labeled **"Mark Entered in PMS."** Clicking this changes the database status to `Synced` and sends the guest a "Booking Confirmed" email.
* **SLA Escalation:** If a booking sits in `Pending` status for > 2 hours, the row highlights bright red. If it hits > 4 hours, trigger a high-priority notification (via email/webhook SMS) to management.
