import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const TITLES: Record<string, string> = {
  user_approval: "User needs approval",
  new_ticket: "New ticket created",
  ticket_assigned: "Ticket assigned to you",
  new_comment: "New comment",
};

const BODIES: Record<string, string> = {
  user_approval: "A new user is waiting for approval.",
  new_ticket: "A new ticket was created.",
  ticket_assigned: "A ticket was assigned to you.",
  new_comment: "A new comment was added.",
};

const TRADE_LABELS: Record<string, string> = {
  excavation: 'Excavation',
  foundation: 'Foundation',
  foundation_sealing: 'Foundation Sealing',
  framing: 'Framing',
  siding: 'Siding',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  av: 'AV',
  it: 'IT',
  blueboard_plaster: 'Blueboard / Plaster',
  garage_doors: 'Garage Doors',
  tile: 'Tile',
  masonry: 'Masonry',
  finish_carpentry: 'Finish Carpentry',
  hardwood_flooring: 'Hardwood Flooring',
  cabinets: 'Cabinets',
  countertops: 'Countertops',
  shower_glass_doors: 'Shower Glass Doors',
  flooring: 'Flooring',
  painting: 'Painting',
  windows_doors: 'Windows & Doors',
  roofing: 'Roofing',
  insulation: 'Insulation',
  drywall: 'Drywall',
  other: 'Other',
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { record?: { recipient_id?: string; type?: string; related_id?: string }; recipient_id?: string; type?: string; related_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = body.record ?? body;
  const { recipient_id, type, related_id } = record;
  if (!recipient_id || !type) {
    return new Response(
      JSON.stringify({ error: "recipient_id and type required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("id", recipient_id)
    .single();

  if (fetchError || !profile?.expo_push_token) {
    return new Response(
      JSON.stringify({ sent: false, error: "No push token for user" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let title = TITLES[type] ?? "Notification";
  let bodyText = BODIES[type] ?? "You have a new notification.";
  let ticketId = related_id;

  if (type === "new_ticket" || type === "ticket_assigned") {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("building_element, units(unit_number), profiles!tickets_created_by_fkey(first_name, last_name)")
      .eq("id", related_id)
      .single();

    if (ticket) {
      const unitNumber = Array.isArray(ticket.units) ? ticket.units[0]?.unit_number : ticket.units?.unit_number;
      const element = TRADE_LABELS[ticket.building_element] ?? ticket.building_element;
      const parts = [];
      if (unitNumber) parts.push(`Unit ${unitNumber}`);
      if (element) parts.push(element);
      
      if (parts.length > 0) {
        title = (type === "new_ticket" ? "New Ticket" : "Ticket Assigned") + " — " + parts.join(" • ");
      }

      const creatorProfile = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles;
      if (creatorProfile) {
        const creatorName = [creatorProfile.first_name, creatorProfile.last_name].filter(Boolean).join(" ");
        if (creatorName) {
          bodyText = `Created by ${creatorName}`;
        }
      }
    }
  } else if (type === "new_comment") {
    const { data: comment } = await supabase
      .from("ticket_comments")
      .select("ticket_id, message, user_id, profiles(first_name, last_name)")
      .eq("id", related_id)
      .single();

    if (comment) {
      ticketId = comment.ticket_id;
      const { data: ticket } = await supabase
        .from("tickets")
        .select("building_element, units(unit_number)")
        .eq("id", comment.ticket_id)
        .single();
      
      let unitContext = "";
      if (ticket) {
        const unitNumber = Array.isArray(ticket.units) ? ticket.units[0]?.unit_number : ticket.units?.unit_number;
        const element = TRADE_LABELS[ticket.building_element] ?? ticket.building_element;
        const parts = [];
        if (unitNumber) parts.push(`Unit ${unitNumber}`);
        if (element) parts.push(element);
        if (parts.length > 0) {
          unitContext = " — " + parts.join(" • ");
        }
      }

      title = `New Comment${unitContext}`;

      const commentProfile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
      const creatorName = commentProfile ? [commentProfile.first_name, commentProfile.last_name].filter(Boolean).join(" ") : "Someone";
      bodyText = `${creatorName}: ${comment.message}`;
    }
  } else if (type === "user_approval") {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", related_id)
      .single();
      
    if (userProfile) {
      const userName = [userProfile.first_name, userProfile.last_name].filter(Boolean).join(" ") || userProfile.email;
      bodyText = `${userName} is waiting for approval.`;
    }
  }

  const expoPayload = {
    to: profile.expo_push_token,
    title,
    body: bodyText,
    data: { type, related_id: ticketId ?? null },
    sound: "default",
  };

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([expoPayload]),
  });

  if (!expoRes.ok) {
    const errText = await expoRes.text();
    return new Response(
      JSON.stringify({ sent: false, error: errText }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const expoData = await expoRes.json();
  const ticket = expoData?.data?.[0];
  const ok = ticket?.status === "ok";
  return new Response(
    JSON.stringify({ sent: ok, ticket: ticket?.id ?? null }),
    { headers: { "Content-Type": "application/json" } }
  );
});
