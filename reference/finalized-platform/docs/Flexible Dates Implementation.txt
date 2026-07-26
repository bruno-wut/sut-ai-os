If a guest searches for a room and it is sold out, we don't want to query the entire database for the next 365 days—that would exhaust your Supabase compute limits and slow down the Cloudflare edge workers. Instead, we want to perform a lightweight, constrained Lookahead Query.

Here is the step-by-step implementation plan to hand off to your Next.js and Supabase engineering team.

Step 1: The Database Layer (Supabase RPC Lookahead)
Your current availability query checks a specific date range, subtracts reservations and checkout_holds, and returns true/false.

We need to create a new Supabase RPC (Remote Procedure Call) called find_next_available_date.

The Logic: If the requested dates (e.g., 13/7 to 15/7) are full, this function scans a strictly limited window (e.g., +7 days from the requested check-in).

How it works with the Tetris Engine: It iterates through the next 7 days, checking total room inventory minus (Active Reservations + Active Checkout Holds).

The Output: The moment it finds a day where available_rooms > 0, it stops and returns that single date string (e.g., 2026-07-14). If nothing is found within 7 days, it returns null.

Instructions for the Backend Dev:
Create a SQL function in Supabase that accepts:

p_room_type_id

p_start_date (The failed check-in date)

p_length_of_stay (Keep the guest's desired duration, e.g., 2 nights)
Limit the search to a generate_series of 7 days to keep the database response under 50ms.

Step 2: The Next.js Server Action (The Middle Layer)
In your Next.js application (where you fetch room availability for the IBE), you will chain this logic so that it only fires if the room is sold out. We do not want to run this query for rooms that are already available.

Instructions for the Full-Stack Dev:
Update your checkAvailability server action:

TypeScript
// Pseudo-code for your Next.js Server Action
export async function getRoomAvailability(roomTypeId, checkIn, checkOut) {
  // 1. Run your standard Tetris availability check
  let isAvailable = await checkStandardAvailability(roomTypeId, checkIn, checkOut);
  
  let nextAvailableDate = null;

  // 2. ONLY if sold out, trigger the lookahead nudge
  if (!isAvailable) {
    nextAvailableDate = await supabase.rpc('find_next_available_date', {
      p_room_type_id: roomTypeId,
      p_start_date: checkIn,
      p_length_of_stay: calculateNights(checkIn, checkOut)
    });
  }

  return {
    isAvailable,
    nextAvailableDate // Will be '2026-07-14' or null
  };
}
Step 3: The IBE Frontend UI (The "Quiet Ledger" Aesthetic)
Now that your frontend receives the nextAvailableDate variable, we can render the elegant UX solution we discussed.

Instructions for the Frontend Dev:
In your Room Card component (room-card.tsx), update the conditional rendering where the "Book Now" button usually lives.

TypeScript
{/* If the room is fully booked for requested dates */}
{!room.isAvailable && (
  <div className="flex flex-col items-end">
    <span className="text-stone-500 font-medium">Fully Booked</span>
    
    {/* The Nudge: Only show if the database found a nearby date */}
    {room.nextAvailableDate && (
      <div className="mt-2 text-sm text-stone-400 text-right">
        <p>Available starting {formatDate(room.nextAvailableDate)}</p>
        <button 
          onClick={() => updateUrlDates(room.nextAvailableDate)} 
          className="underline underline-offset-4 hover:text-stone-700 transition-colors"
        >
          Shift dates to match
        </button>
      </div>
    )}
  </div>
)}
Step 4: The State Handoff (URL Parameters)
When the guest clicks "Shift dates to match" (or "เปลี่ยนวันเข้าพัก" in Thai), the Next.js app shouldn't rely on complex React state that might get lost.

Instead, leverage your existing URL parameter routing. The updateUrlDates function simply pushes new parameters to the browser:
router.push('/book?checkIn=2026-07-14&checkOut=2026-07-16')

Because your Next.js application is cleanly architected, changing the URL will automatically re-trigger the Server Components, re-run the availability check (which will now pass!), and the "Book Now" button will elegantly unlock.

Why this architecture is perfect for Sri U-Thong Grand Hotel:
Protects Cloudflare Limits: By only checking a maximum of +7 days, and only running the query if a room is sold out, you prevent compute exhaustion.

Protects the Tetris Engine: It respects your existing checkout_holds so it won't accidentally recommend a date that is currently locked in another guest's 15-minute shopping cart.

Saves the Sale: It turns a guaranteed bounce (a guest leaving your site) into a highly probable date adjustment.