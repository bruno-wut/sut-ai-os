import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";

import pg from "pg";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

if (process.env.ALLOCATION_CONCURRENCY_TEST_ENABLED !== "true") {
  throw new Error(
    "Set ALLOCATION_CONCURRENCY_TEST_ENABLED=true to run the isolated allocation stress test.",
  );
}

const connectionString = process.env.SUPABASE_DATABASE_URL;
const stagingProjectRef = process.env.STAGING_SUPABASE_PROJECT_REF;

if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL is required.");
}

if (!stagingProjectRef || !/^[a-z0-9]{20}$/.test(stagingProjectRef)) {
  throw new Error(
    "Set STAGING_SUPABASE_PROJECT_REF to the approved 20-character staging project ref.",
  );
}

if (!connectionString.includes(stagingProjectRef)) {
  throw new Error(
    "SUPABASE_DATABASE_URL does not match STAGING_SUPABASE_PROJECT_REF. Refusing to run against an unverified database.",
  );
}

const { Pool } = pg;
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 10_000,
  max: 40,
  ssl: { rejectUnauthorized: false },
});

const runId = randomUUID();
const runLabel = `allocation-stress-${runId}`;
const createdHotelIds = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isExpectedInventoryError(error) {
  return (
    error instanceof Error &&
    (error.message === "INSUFFICIENT_INVENTORY" ||
      error.message === "TETRIS_ALLOCATION_REQUIRED" ||
      error.message === "TETRIS_PLAN_NOT_FOUND")
  );
}

async function withConcurrentClients(count, operation) {
  const clients = await Promise.all(
    Array.from({ length: count }, () => pool.connect()),
  );

  try {
    return await Promise.all(
      clients.map((client, index) => operation(client, index)),
    );
  } finally {
    for (const client of clients) {
      client.release();
    }
  }
}

async function createInventory({
  roomCount,
  roomTypeCode,
  roomTypeName,
  checkIn,
  checkOut,
}) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const hotelResult = await client.query(
      `
        insert into public.hotel_settings (
          setup_completed_at,
          inventory_horizon_days,
          max_rooms_per_booking
        )
        values (now(), 365, 5)
        returning id
      `,
    );
    const hotelId = hotelResult.rows[0].id;
    createdHotelIds.push(hotelId);

    const roomTypeResult = await client.query(
      `
        insert into public.room_types (
          hotel_id,
          code,
          name,
          base_nightly_rate
        )
        values ($1, $2, $3, 1800)
        returning id
      `,
      [hotelId, roomTypeCode, roomTypeName],
    );
    const roomTypeId = roomTypeResult.rows[0].id;

    const roomResult = await client.query(
      `
        insert into public.physical_rooms (
          hotel_id,
          room_type_id,
          room_number,
          web_allocation_enabled
        )
        select
          $1,
          $2,
          $3 || '-' || lpad(series.room_index::text, 2, '0'),
          true
        from generate_series(1, $4::integer) as series(room_index)
        returning id, room_number
      `,
      [hotelId, roomTypeId, roomTypeCode, roomCount],
    );

    await client.query(
      `
        insert into public.physical_room_allotments (
          hotel_id,
          room_id,
          room_type_id,
          date,
          room_number,
          room_type,
          nightly_price
        )
        select
          $1,
          room.id,
          $2,
          stay_date::date,
          room.room_number,
          $3,
          1800
        from unnest($4::uuid[], $5::text[]) as room(id, room_number)
        cross join generate_series(
          $6::date,
          $7::date - 1,
          interval '1 day'
        ) as stay_date
      `,
      [
        hotelId,
        roomTypeId,
        roomTypeName,
        roomResult.rows.map((row) => row.id),
        roomResult.rows.map((row) => row.room_number),
        checkIn,
        checkOut,
      ],
    );

    await client.query("commit");

    return {
      hotelId,
      roomTypeId,
      rooms: roomResult.rows,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function createDirectHold(client, {
  checkIn,
  checkOut,
  idempotencyKey,
  roomTypeId,
  roomsRequested,
}) {
  const result = await client.query(
    `
      select public.create_checkout_hold(
        $1::date,
        $2::date,
        $3::uuid,
        $4::integer,
        $5::integer,
        0,
        $6,
        null
      ) as hold
    `,
    [
      checkIn,
      checkOut,
      roomTypeId,
      roomsRequested,
      roomsRequested * 2,
      idempotencyKey,
    ],
  );

  return result.rows[0].hold;
}

async function createTetrisHold(client, {
  checkIn,
  checkOut,
  idempotencyKey,
  roomTypeId,
  roomsRequested,
}) {
  const result = await client.query(
    `
      select public.create_tetris_checkout_hold(
        $1::date,
        $2::date,
        $3::uuid,
        $4::integer,
        $5::integer,
        0,
        $6,
        null
      ) as hold
    `,
    [
      checkIn,
      checkOut,
      roomTypeId,
      roomsRequested,
      roomsRequested * 2,
      idempotencyKey,
    ],
  );

  return result.rows[0].hold;
}

async function runHighVolumeMultiRoomRace() {
  const checkIn = new Date(Date.now() + 70 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const checkOut = new Date(Date.now() + 73 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const code = `HV${runId.replaceAll("-", "").slice(0, 10)}`;
  const inventory = await createInventory({
    roomCount: 24,
    roomTypeCode: code,
    roomTypeName: `${runLabel}-high-volume`,
    checkIn,
    checkOut,
  });

  const outcomes = await withConcurrentClients(16, async (client, index) => {
    try {
      const hold = await createDirectHold(client, {
        checkIn,
        checkOut,
        idempotencyKey: `${runLabel}-high-volume-${index}`,
        roomTypeId: inventory.roomTypeId,
        roomsRequested: 2,
      });
      return { hold, status: "fulfilled" };
    } catch (error) {
      if (!isExpectedInventoryError(error)) {
        throw error;
      }
      return { error: error.message, status: "rejected" };
    }
  });

  const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

  assert(fulfilled.length === 12, "Expected exactly 12 successful two-room holds.");
  assert(rejected.length === 4, "Expected exactly four capacity rejections.");
  assert(
    rejected.every((outcome) => outcome.error === "INSUFFICIENT_INVENTORY"),
    "Capacity losers must fail as insufficient inventory.",
  );

  const integrity = await pool.query(
    `
      select
        count(distinct ch.id)::integer as hold_count,
        count(chrn.id)::integer as room_night_count,
        count(distinct chrn.allotment_id)::integer as distinct_allotment_count,
        min(per_hold.room_nights)::integer as min_room_nights,
        max(per_hold.room_nights)::integer as max_room_nights
      from public.checkout_holds ch
      join public.checkout_hold_room_nights chrn on chrn.hold_id = ch.id
      join (
        select hold_id, count(*)::integer as room_nights
        from public.checkout_hold_room_nights
        group by hold_id
      ) per_hold on per_hold.hold_id = ch.id
      where ch.hotel_id = $1
        and ch.idempotency_key like $2
    `,
    [inventory.hotelId, `${runLabel}-high-volume-%`],
  );
  const row = integrity.rows[0];

  assert(row.hold_count === 12, "High-volume race created an unexpected hold count.");
  assert(row.room_night_count === 72, "High-volume race lost room-night rows.");
  assert(
    row.distinct_allotment_count === 72,
    "High-volume race double-allocated an allotment.",
  );
  assert(
    row.min_room_nights === 6 && row.max_room_nights === 6,
    "A successful two-room hold is not complete across all three nights.",
  );

  return {
    rejected: rejected.length,
    successful: fulfilled.length,
  };
}

async function runIdempotencyStorm() {
  const checkIn = new Date(Date.now() + 80 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const checkOut = new Date(Date.now() + 82 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const code = `ID${runId.replaceAll("-", "").slice(0, 10)}`;
  const inventory = await createInventory({
    roomCount: 5,
    roomTypeCode: code,
    roomTypeName: `${runLabel}-idempotency`,
    checkIn,
    checkOut,
  });
  const idempotencyKey = `${runLabel}-same-idempotency-key`;

  const holds = await withConcurrentClients(24, (client) =>
    createDirectHold(client, {
      checkIn,
      checkOut,
      idempotencyKey,
      roomTypeId: inventory.roomTypeId,
      roomsRequested: 3,
    }),
  );

  const holdTokens = new Set(holds.map((hold) => hold.hold_token));
  assert(holdTokens.size === 1, "Concurrent retries returned different hold tokens.");
  assert(
    holds.every((hold) => hold.ok === true && hold.rooms_requested === 3),
    "An idempotent retry returned a different result shape.",
  );

  const integrity = await pool.query(
    `
      select
        count(distinct ch.id)::integer as hold_count,
        count(chrn.id)::integer as room_night_count,
        count(distinct chrn.allotment_id)::integer as distinct_allotment_count
      from public.checkout_holds ch
      join public.checkout_hold_room_nights chrn on chrn.hold_id = ch.id
      where ch.hotel_id = $1
        and ch.idempotency_key = $2
    `,
    [inventory.hotelId, idempotencyKey],
  );
  const row = integrity.rows[0];

  assert(row.hold_count === 1, "Idempotency storm created duplicate holds.");
  assert(row.room_night_count === 6, "Idempotent hold has incomplete room nights.");
  assert(
    row.distinct_allotment_count === 6,
    "Idempotent hold duplicated an allotment.",
  );

  return { callers: holds.length, uniqueHolds: row.hold_count };
}

async function runMaximumRoomRace() {
  const checkIn = new Date(Date.now() + 85 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const checkOut = new Date(Date.now() + 87 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const code = `MR${runId.replaceAll("-", "").slice(0, 10)}`;
  const inventory = await createInventory({
    roomCount: 25,
    roomTypeCode: code,
    roomTypeName: `${runLabel}-maximum-room`,
    checkIn,
    checkOut,
  });

  const outcomes = await withConcurrentClients(8, async (client, index) => {
    try {
      const hold = await createDirectHold(client, {
        checkIn,
        checkOut,
        idempotencyKey: `${runLabel}-maximum-room-${index}`,
        roomTypeId: inventory.roomTypeId,
        roomsRequested: 5,
      });
      return { hold, status: "fulfilled" };
    } catch (error) {
      if (!isExpectedInventoryError(error)) {
        throw error;
      }
      return { error: error.message, status: "rejected" };
    }
  });
  const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

  assert(fulfilled.length === 5, "Expected five maximum-size booking winners.");
  assert(rejected.length === 3, "Expected three maximum-size capacity losers.");
  assert(
    rejected.every((outcome) => outcome.error === "INSUFFICIENT_INVENTORY"),
    "Maximum-size capacity losers returned an unexpected error.",
  );

  const integrity = await pool.query(
    `
      select
        count(distinct ch.id)::integer as hold_count,
        count(chrn.id)::integer as room_night_count,
        count(distinct chrn.allotment_id)::integer as distinct_allotment_count,
        min(per_hold.room_nights)::integer as min_room_nights,
        max(per_hold.room_nights)::integer as max_room_nights
      from public.checkout_holds ch
      join public.checkout_hold_room_nights chrn on chrn.hold_id = ch.id
      join (
        select hold_id, count(*)::integer as room_nights
        from public.checkout_hold_room_nights
        group by hold_id
      ) per_hold on per_hold.hold_id = ch.id
      where ch.hotel_id = $1
        and ch.idempotency_key like $2
    `,
    [inventory.hotelId, `${runLabel}-maximum-room-%`],
  );
  const row = integrity.rows[0];

  assert(row.hold_count === 5, "Maximum-room race created an unexpected hold count.");
  assert(row.room_night_count === 50, "Maximum-room race lost room-night rows.");
  assert(
    row.distinct_allotment_count === 50,
    "Maximum-room race double-allocated an allotment.",
  );
  assert(
    row.min_room_nights === 10 && row.max_room_nights === 10,
    "A successful five-room hold is incomplete across both nights.",
  );

  return {
    rejected: rejected.length,
    successful: fulfilled.length,
  };
}

async function seedFragmentedReservations(inventory, checkIn) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    for (let index = 0; index < 4; index += 1) {
      const stayDate = new Date(
        new Date(`${checkIn}T00:00:00.000Z`).getTime() + index * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      const checkoutDate = new Date(
        new Date(`${stayDate}T00:00:00.000Z`).getTime() + 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      const room = inventory.rooms[index];
      const reservationResult = await client.query(
        `
          insert into public.web_reservations (
            hotel_id,
            reservation_number,
            stripe_session_id,
            guest_name,
            guest_email,
            guest_phone,
            check_in_date,
            check_out_date,
            room_type_id,
            room_type,
            rooms_requested,
            adults,
            children,
            assignment_status,
            assignments_finalized_at,
            total_paid,
            currency,
            sync_status,
            room_shuffle_required,
            payment_received_at,
            payment_mode,
            payment_status,
            amount_due
          )
          values (
            $1,
            $2,
            null,
            'Allocation Stress Guest',
            'allocation-stress@example.invalid',
            '+66000000000',
            $3,
            $4,
            $5,
            $6,
            1,
            2,
            0,
            'assigned',
            now(),
            0,
            'THB',
            'Pending',
            false,
            null,
            'pay_at_hotel',
            'not_collected',
            1800
          )
          returning id
        `,
        [
          inventory.hotelId,
          `STRESS-${runId.slice(0, 8)}-${index}`,
          stayDate,
          checkoutDate,
          inventory.roomTypeId,
          `${runLabel}-fragmented`,
        ],
      );
      const reservationId = reservationResult.rows[0].id;

      const allotmentResult = await client.query(
        `
          update public.physical_room_allotments
          set
            is_booked = true,
            booked_reservation_id = $1
          where hotel_id = $2
            and room_id = $3
            and date = $4
          returning id
        `,
        [reservationId, inventory.hotelId, room.id, stayDate],
      );

      assert(
        allotmentResult.rowCount === 1,
        "Fragmentation fixture did not book exactly one allotment.",
      );

      await client.query(
        `
          insert into public.reservation_room_nights (
            reservation_id,
            allotment_id,
            stay_date,
            room_position,
            room_id,
            room_type_id,
            nightly_price
          )
          values ($1, $2, $3, 1, $4, $5, 1800)
        `,
        [
          reservationId,
          allotmentResult.rows[0].id,
          stayDate,
          room.id,
          inventory.roomTypeId,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function createWithTetrisFallback(client, request) {
  try {
    return {
      hold: await createDirectHold(client, request),
      status: "fulfilled",
    };
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "TETRIS_ALLOCATION_REQUIRED") {
      if (isExpectedInventoryError(error)) {
        return { error: error.message, status: "rejected" };
      }
      throw error;
    }
  }

  try {
    return {
      hold: await createTetrisHold(client, request),
      status: "fulfilled",
    };
  } catch (error) {
    if (!isExpectedInventoryError(error)) {
      throw error;
    }
    return { error: error.message, status: "rejected" };
  }
}

async function runFragmentedTetrisRace() {
  const checkIn = new Date(Date.now() + 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const checkOut = new Date(Date.now() + 94 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const code = `TF${runId.replaceAll("-", "").slice(0, 10)}`;
  const inventory = await createInventory({
    roomCount: 6,
    roomTypeCode: code,
    roomTypeName: `${runLabel}-fragmented`,
    checkIn,
    checkOut,
  });

  await seedFragmentedReservations(inventory, checkIn);

  const directProbe = await pool.connect();
  try {
    let probeError;
    try {
      await createDirectHold(directProbe, {
        checkIn,
        checkOut,
        idempotencyKey: `${runLabel}-fragmentation-probe`,
        roomTypeId: inventory.roomTypeId,
        roomsRequested: 3,
      });
    } catch (error) {
      probeError = error;
    }
    assert(
      probeError instanceof Error &&
        probeError.message === "TETRIS_ALLOCATION_REQUIRED",
      "The seeded grid did not force the Tetris path.",
    );
  } finally {
    directProbe.release();
  }

  const outcomes = await withConcurrentClients(2, (client, index) =>
    createWithTetrisFallback(client, {
      checkIn,
      checkOut,
      idempotencyKey: `${runLabel}-tetris-racer-${index}`,
      roomTypeId: inventory.roomTypeId,
      roomsRequested: 3,
    }),
  );
  const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

  assert(fulfilled.length === 1, "Fragmented race must have exactly one winner.");
  assert(rejected.length === 1, "Fragmented race must reject exactly one loser.");
  assert(
    fulfilled[0].hold.allocation_mode === "tetris",
    "Fragmented race winner did not use Tetris.",
  );
  assert(
    rejected[0].error === "INSUFFICIENT_INVENTORY",
    "Fragmented race loser returned an unexpected error.",
  );

  const integrity = await pool.query(
    `
      with stress_holds as (
        select id
        from public.checkout_holds
        where hotel_id = $1
          and idempotency_key like $2
      )
      select
        (select count(*)::integer from stress_holds) as hold_count,
        (
          select count(*)::integer
          from public.checkout_hold_room_nights chrn
          where chrn.hold_id in (select id from stress_holds)
        ) as held_room_nights,
        (
          select count(*)::integer
          from public.room_shuffle_plans rsp
          where rsp.hotel_id = $1
            and rsp.hold_id in (select id from stress_holds)
        ) as shuffle_plan_count,
        (
          select count(*)::integer
          from public.room_shuffle_steps rss
          join public.room_shuffle_plans rsp on rsp.id = rss.plan_id
          where rsp.hotel_id = $1
            and rsp.hold_id in (select id from stress_holds)
        ) as shuffle_step_count,
        (
          select count(*)::integer
          from public.physical_room_allotments pra
          where pra.hotel_id = $1
            and pra.is_booked
            and pra.booked_reservation_id is not null
        ) as booked_room_nights,
        (
          select count(*)::integer
          from public.reservation_room_nights rrn
          join public.web_reservations wr on wr.id = rrn.reservation_id
          where wr.hotel_id = $1
            and rrn.status = 'active'
        ) as active_reservation_room_nights
    `,
    [inventory.hotelId, `${runLabel}-tetris-racer-%`],
  );
  const row = integrity.rows[0];

  assert(row.hold_count === 1, "Tetris race created duplicate winning holds.");
  assert(row.held_room_nights === 12, "Tetris winner has an incomplete hold.");
  assert(row.shuffle_plan_count === 1, "Tetris winner lacks one shuffle plan.");
  assert(row.shuffle_step_count === 1, "Expected one deterministic single-hop move.");
  assert(
    row.booked_room_nights === 4 && row.active_reservation_room_nights === 4,
    "Tetris move lost or duplicated an existing reservation room-night.",
  );

  const overlap = await pool.query(
    `
      select count(*)::integer as overlap_count
      from public.physical_room_allotments
      where hotel_id = $1
        and is_booked
        and hold_id is not null
    `,
    [inventory.hotelId],
  );
  assert(
    overlap.rows[0].overlap_count === 0,
    "An allotment is simultaneously booked and held.",
  );

  return {
    rejected: rejected.length,
    shuffleSteps: row.shuffle_step_count,
    successful: fulfilled.length,
  };
}

async function runAbandonedHoldRecovery() {
  const checkIn = new Date(Date.now() + 100 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const checkOut = new Date(Date.now() + 102 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const code = `HR${runId.replaceAll("-", "").slice(0, 10)}`;
  const inventory = await createInventory({
    roomCount: 1,
    roomTypeCode: code,
    roomTypeName: `${runLabel}-hold-recovery`,
    checkIn,
    checkOut,
  });
  const idempotencyKey = `${runLabel}-abandoned-hold`;
  const client = await pool.connect();

  try {
    const hold = await createDirectHold(client, {
      checkIn,
      checkOut,
      idempotencyKey,
      roomTypeId: inventory.roomTypeId,
      roomsRequested: 1,
    });
    assert(hold.ok === true, "Abandoned hold fixture could not be created.");

    const beforeExpiry = await client.query(
      `
        select count(*)::integer as held_nights
        from public.physical_room_allotments pra
        join public.checkout_holds ch on ch.id = pra.hold_id
        where ch.hotel_id = $1 and ch.idempotency_key = $2
      `,
      [inventory.hotelId, idempotencyKey],
    );
    assert(beforeExpiry.rows[0].held_nights === 2, "Abandoned hold did not reserve both room nights.");

    await client.query(
      `
        update public.checkout_holds
        set 
          created_at = now() - interval '40 minutes',
          expires_at = now() - interval '5 minutes'
        where hotel_id = $1 and idempotency_key = $2
      `,
      [inventory.hotelId, idempotencyKey],
    );
    const released = await client.query(
      "select public.release_expired_checkout_holds($1::uuid)::integer as released_count",
      [inventory.hotelId],
    );
    assert(released.rows[0].released_count === 1, "Expiry path did not release exactly one abandoned hold.");

    const afterExpiry = await client.query(
      `
        select
          (select status::text from public.checkout_holds where hotel_id = $1 and idempotency_key = $2) as status,
          count(*) filter (where hold_id is null)::integer as sellable_nights
        from public.physical_room_allotments
        where hotel_id = $1 and room_type_id = $3
      `,
      [inventory.hotelId, idempotencyKey, inventory.roomTypeId],
    );
    assert(afterExpiry.rows[0].status === "expired", "Abandoned hold was not marked expired.");
    assert(afterExpiry.rows[0].sellable_nights === 2, "Inventory did not return by one room across the held nights.");

    const operationalJob = await client.query(
      "select public.run_hotel_operational_jobs() as result",
    );
    assert(operationalJob.rows[0].result.ok === true, "Operational recovery job did not complete.");

    return { releasedHolds: released.rows[0].released_count, sellableNights: afterExpiry.rows[0].sellable_nights };
  } finally {
    client.release();
  }
}

async function cleanup() {
  for (const hotelId of createdHotelIds.reverse()) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `
          update public.physical_room_allotments
          set
            is_booked = false,
            booked_reservation_id = null,
            hold_id = null,
            hold_expires_at = null
          where hotel_id = $1
        `,
        [hotelId],
      );
      await client.query(
        "delete from public.room_shuffle_plans where hotel_id = $1",
        [hotelId],
      );
      const subQuery = "select id from public.web_reservations where hotel_id = $1";
      await client.query("delete from public.reservation_room_nights where reservation_id in (" + subQuery + ")", [hotelId]);
      await client.query("delete from public.reservation_payment_events where reservation_id in (" + subQuery + ")", [hotelId]);
      await client.query("delete from public.reservation_sync_events where reservation_id in (" + subQuery + ")", [hotelId]);
      await client.query("delete from public.reservation_edit_events where reservation_id in (" + subQuery + ")", [hotelId]);
      await client.query("delete from public.reservation_refund_requests where reservation_id in (" + subQuery + ")", [hotelId]);
      await client.query("delete from public.notification_events where reservation_id in (" + subQuery + ")", [hotelId]);
      await client.query("delete from public.consent_records where reservation_id in (" + subQuery + ")", [hotelId]);
      await client.query(
        "delete from public.web_reservations where hotel_id = $1",
        [hotelId],
      );
      await client.query(
        "delete from public.checkout_holds where hotel_id = $1",
        [hotelId],
      );
      await client.query(
        "delete from public.physical_room_allotments where hotel_id = $1",
        [hotelId],
      );
      await client.query(
        "delete from public.physical_rooms where hotel_id = $1",
        [hotelId],
      );
      await client.query(
        "delete from public.room_types where hotel_id = $1",
        [hotelId],
      );
      await client.query("delete from public.hotel_settings where id = $1", [
        hotelId,
      ]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

try {
  const staleFixtures = await pool.query(
    `
      select distinct rt.hotel_id
      from public.room_types rt
      where rt.name like 'allocation-stress-%'
    `,
  );
  createdHotelIds.push(...staleFixtures.rows.map((row) => row.hotel_id));
  await cleanup();

  const highVolume = await runHighVolumeMultiRoomRace();
  const idempotency = await runIdempotencyStorm();
  const maximumRoom = await runMaximumRoomRace();
  const fragmented = await runFragmentedTetrisRace();
  const holdRecovery = await runAbandonedHoldRecovery();

  console.log("Allocation concurrency stress test passed.");
  console.table({ fragmented, highVolume, holdRecovery, idempotency, maximumRoom });
} finally {
  try {
    await cleanup();
  } finally {
    await pool.end();
  }
}
