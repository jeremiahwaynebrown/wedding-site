import {
  getSupabaseClient,
  normalizePartyName
} from "./_supabase.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const partyName = String(request.body?.partyName ?? "").trim();

    if (!partyName) {
      return response.status(400).json({
        error: "Enter the party name exactly as it appears on the invitation."
      });
    }

    if (partyName.length > 150) {
      return response.status(400).json({
        error: "The party name is too long."
      });
    }

    const normalizedPartyName = normalizePartyName(partyName);
    const supabase = getSupabaseClient();

    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select(`
        id,
        party_name,
        max_guests,
        attendance_status,
        contact_email,
        contact_phone,
        message,
        submitted_at
      `)
      .eq("normalized_party_name", normalizedPartyName)
      .maybeSingle();

    if (partyError) {
      console.error("Party lookup error:", partyError);

      return response.status(500).json({
        error: "We could not look up your invitation right now."
      });
    }

    if (!party) {
      return response.status(404).json({
        error:
          "We could not find that invitation. Enter the name exactly as it appears on the envelope."
      });
    }

    let attendees = [];

    if (party.attendance_status === "attending") {
      const { data, error: attendeeError } = await supabase
        .from("attendees")
        .select("full_name, dietary_notes")
        .eq("party_id", party.id)
        .order("id");

      if (attendeeError) {
        console.error("Attendee lookup error:", attendeeError);

        return response.status(500).json({
          error: "We found your invitation but could not load the RSVP."
        });
      }

      attendees = data ?? [];
    }

    return response.status(200).json({
      party: {
        partyName: party.party_name,
        maxGuests: party.max_guests,
        attendanceStatus: party.attendance_status,
        contactEmail: party.contact_email ?? "",
        contactPhone: party.contact_phone ?? "",
        message: party.message ?? "",
        submittedAt: party.submitted_at,
        attendees
      }
    });
  } catch (error) {
    console.error("Unexpected lookup error:", error);

    return response.status(500).json({
      error: "Something went wrong while looking up your invitation."
    });
  }
}