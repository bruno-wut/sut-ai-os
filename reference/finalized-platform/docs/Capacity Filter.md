Implementation Plan: Graceful Capacity Filter & Cross-SellProject: Sri U-Thong Grand Hotel RebrandingObjective: Prevent guests from overbooking small rooms (e.g., 4 adults in 1 Classic Room) by gracefully disabling the booking button and offering a 1-click cross-sell to add an additional room.Step 1: Database/Query Verification (Supabase)Before updating the Next.js logic, ensure your existing Supabase query that fetches room_types is pulling the maximum occupancy limit.Action: Ensure your getLiveRoomOptions function selects the max_adults (or equivalent capacity column) from your room_types table.Step 2: The Data Layer (Next.js Backend)File: src/lib/booking-data.tsWe will calculate the required capacity purely in Next.js Node.js layer to save database compute.Instructions for Backend Dev:Update your RoomOption TypeScript interface to include the new capacity variables.Calculate requiredAdultsPerRoom using Math.ceil().Intercept the mapping logic before returning the data to the UI.TypeScript// 1. Update the Type Interface
export interface RoomOption {
  // ... existing fields ...
  maxAdults: number;
  isAvailable: boolean;
  notAvailableReason?: 'SOLD_OUT' | 'CAPACITY_EXCEEDED' | null;
  capacityMessage?: string;
}

// Inside your getLiveRoomOptions function:
export async function getLiveRoomOptions(searchParams) {
  const { checkIn, checkOut, adults = 2, rooms = 1 } = searchParams;
  
  // Calculate minimum capacity needed per room
  // e.g., 4 adults / 1 room = 4.  (Needs Grand Residence)
  // e.g., 3 adults / 2 rooms = 1.5 -> rounds up to 2. (Classic is fine)
  const requiredAdultsPerRoom = Math.ceil(adults / rooms);

  // ... fetch data from Supabase ...

  const mappedOptions = data.map(room => {
    // Check if physically sold out first
    if (room.available_rooms <= 0) {
      return { ...room, isAvailable: false, notAvailableReason: 'SOLD_OUT' };
    }

    // Check Capacity Limit
    if (requiredAdultsPerRoom > room.max_adults) {
      return {
        ...room,
        isAvailable: false,
        notAvailableReason: 'CAPACITY_EXCEEDED',
        capacityMessage: `Maximum ${room.max_adults} adults per room` 
        // Thai translation handled in the UI layer below
      };
    }

    // Room is fully available and fits the guests
    return { ...room, isAvailable: true, notAvailableReason: null };
  });

  return mappedOptions;
}
Step 3: The UI Layer (Next.js Frontend)File: src/components/booking/booking-experience.tsxWe need to render the "Quiet Ledger" aesthetic for the rejected state. It must look intentional, premium, and instantly offer a solution.Instructions for Frontend Dev:Update the conditional rendering block inside your room card component where the pricing and "Book Now" button normally sit.TypeScript{/* Inside the room card's right-hand action column */}

{room.notAvailableReason === 'CAPACITY_EXCEEDED' ? (
  <div className="flex flex-col items-end text-right">
    <span className="text-stone-500 font-medium tracking-wide">
      {locale === 'th' ? 'เกินจำนวนผู้เข้าพักสูงสุด' : 'Exceeds Capacity'}
    </span>
    
    <span className="mt-1 text-sm text-stone-400">
      {locale === 'th' 
        ? `รองรับสูงสุด ${room.maxAdults} ท่านต่อห้อง` 
        : `Maximum ${room.maxAdults} adults per room`}
    </span>
    
    {/* The Upsell Nudge: Updates URL parameters */}
    <button 
      onClick={() => handleAddRoom(currentRooms + 1)}
      className="mt-3 text-sm underline underline-offset-4 text-stone-600 hover:text-stone-900 transition-colors duration-200"
    >
      {locale === 'th' ? 'เพิ่มห้องพักเพื่อจองประเภทนี้' : 'Add another room to stay here'}
    </button>
  </div>
) : room.notAvailableReason === 'SOLD_OUT' ? (
  <div className="flex flex-col items-end text-right">
    <span className="text-stone-500 font-medium tracking-wide">
      {locale === 'th' ? 'ห้องพักเต็ม' : 'Fully Booked'}
    </span>
    {/* ... Flexible dates logic goes here ... */}
  </div>
) : (
  <button className="bg-stone-900 text-white px-6 py-2 hover:bg-stone-800 transition-colors">
    {locale === 'th' ? 'จองเลย' : 'Book Now'}
  </button>
)}
Step 4: The URL State HandoffJust like the Flexible Dates feature, the handleAddRoom function should not rely on complex React state. It should simply push a new URL parameter to the router.TypeScriptconst handleAddRoom = (newRoomCount: number) => {
  const params = new URLSearchParams(window.location.search);
  params.set('rooms', newRoomCount.toString());
  router.push(`${pathname}?${params.toString()}`);
};
Verification Checklist for QA:The Math Check: Search 3 Adults, 1 Room. Classic Room (Max 2) should show "Exceeds Capacity". Deluxe Room (Max 3) should show "Book Now".The Cross-Sell Check: On that same search, click "Add another room to stay here" under the Classic Room. The page should reload with rooms=2. Because $3/2 = 1.5$, the Classic Room should instantly unlock and become bookable!