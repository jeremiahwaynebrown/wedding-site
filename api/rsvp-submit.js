import {
  cleanText,
  getSupabaseClient,
  normalizePartyName
} from "./_supabase.js";

function validateEmail(value) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const partyName = cleanText(request.body?.partyName, 150);

    const attendanceStatus = cleanText(
      request.body?.attendanceStatus,
      20
    ).toLowerCase();

    const contactEmail = cleanText(request.body?.contactEmail, 200);
    const contactPhone = cleanText(request.body?.contactPhone, 40);
    const message = cleanText(request.body?.message, 1000);

    const submittedAttendees = Array.isArray(request.body?.attendees)
      ? request.body.attendees
      : [];

    if (!partyName) {
      return response.status(400).json({
        error: "The party name is required."
      });
    }

    if (!["attending", "declined"].includes(attendanceStatus)) {
      return response.status(400).json({
        error: "Choose whether your party is attending or declining."
      });
    }

    if (!validateEmail(contactEmail)) {
      return response.status(400).json({
        error: "Enter a valid email address."
      });
    }

    const supabase = getSupabaseClient();
    const normalizedPartyName = normalizePartyName(partyName);

    const { data: party, error: lookupError } = await supabase
      .from("parties")
      .select("id, party_name, max_guests")
      .eq("normalized_party_name", normalizedPartyName)
      .maybeSingle();

    if (lookupError) {
      console.error("Submission lookup error:", lookupError);

      return response.status(500).json({
        error: "We could not verify your invitation."
      });
    }

    if (!party) {
      return response.status(404).json({
        error:
          "We could not find that invitation. Enter the name exactly as it appears on the envelope."
      });
    }

    const attendees = submittedAttendees
      .map((attendee) => ({
        full_name: cleanText(attendee?.fullName, 150),
        dietary_notes: cleanText(attendee?.dietaryNotes, 300)
      }))
      .filter((attendee) => attendee.full_name);

    if (attendanceStatus === "attending") {
      if (attendees.length === 0) {
        return response.status(400).json({
          error: "Enter at least one attendee name."
        });
      }

      if (attendees.length > party.max_guests) {
        return response.status(400).json({
          error: `This invitation includes a maximum of ${party.max_guests} people.`
        });
      }
    }

    if (attendanceStatus === "declined" && attendees.length > 0) {
      return response.status(400).json({
        error: "A declined RSVP cannot include attendee names."
      });
    }

    const submittedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("parties")
      .update({
        attendance_status: attendanceStatus,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        message: message || null,
        submitted_at: submittedAt,
        updated_at: submittedAt
      })
      .eq("id", party.id);

    if (updateError) {
      console.error("Party update error:", updateError);

      return response.status(500).json({
        error: "We could not save your RSVP."
      });
    }

    const { error: deleteError } = await supabase
      .from("attendees")
      .delete()
      .eq("party_id", party.id);

    if (deleteError) {
      console.error("Attendee deletion error:", deleteError);

      return response.status(500).json({
        error: "The RSVP was updated, but attendee names could not be replaced."
      });
    }

    if (attendanceStatus === "attending") {
      const rows = attendees.map((attendee) => ({
        party_id: party.id,
        full_name: attendee.full_name,
        dietary_notes: attendee.dietary_notes || null
      }));

      const { error: insertError } = await supabase
        .from("attendees")
        .insert(rows);

      if (insertError) {
        console.error("Attendee insertion error:", insertError);

        return response.status(500).json({
          error: "The RSVP was updated, but attendee names could not be saved."
        });
      }
    }

    return response.status(200).json({
      message:
        attendanceStatus === "attending"
          ? "Your RSVP has been submitted. We cannot wait to celebrate with you!"
          : "Your RSVP has been submitted. You will be missed!",
      party: {
        partyName: party.party_name,
        attendanceStatus,
        attendeeCount:
          attendanceStatus === "attending" ? attendees.length : 0,
        maxGuests: party.max_guests,
        submittedAt
      }
    });
  } catch (error) {
    console.error("Unexpected RSVP submission error:", error);

    return response.status(500).json({
      error: "Something went wrong while submitting your RSVP."
    });
  }
}