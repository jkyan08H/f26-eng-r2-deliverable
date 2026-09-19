import { createServerSupabaseClient } from "@/lib/server-utils";
import { generateResponse } from "@/lib/services/species-chat";
import { NextResponse } from "next/server";
import { z } from "zod";

/*
POST /api/chat -- { message: string } in, { response: string } out.

This route spends the site owner's OpenAI credits, so it is the security boundary for the chatbot,
not the page. The navbar only hides the chatbot link when signed out, and the page itself is a
client component with no session check; neither stops anyone from calling this endpoint directly
once the site is deployed. The authentication check below is what actually protects the account.
*/

// Long enough for a real question, short enough that a signed-in caller cannot use the endpoint as
// a funnel for large prompts. Enforced twice: on the raw body size, then on the parsed field.
const MAX_MESSAGE_LENGTH = 1000;
const MAX_BODY_BYTES = 4096;

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export async function POST(request: Request): Promise<NextResponse> {
  /*
  Authentication first -- before the body is read, before validation, and before anything is spent.
  `getUser` revalidates the token with Supabase rather than trusting the cookie's contents, which is
  what makes this a real check and not just cookie-presence. The middleware has already refreshed an
  expiring session by the time this runs, so the read-only cookie accessor is sufficient here.
  */
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError !== null || user === null) {
    return NextResponse.json({ error: "You must be signed in to use the species chatbot." }, { status: 401 });
  }

  // Checked before `request.json()` so an oversized body is rejected without being buffered first.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Message is too long." }, { status: 413 });
  }

  // `request.json()` throws on malformed JSON, which would otherwise surface as an unhandled 500.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Provide a message between 1 and ${MAX_MESSAGE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const result = await generateResponse(parsed.data.message);

  // generateResponse never throws; it reports failure in the result. Both failure reasons are the
  // server's fault rather than the caller's, so both map to 502 -- the caller cannot fix a missing
  // API key by changing their request. The distinction between them lives in the server log.
  if (!result.ok) {
    return NextResponse.json({ error: result.userMessage }, { status: 502 });
  }

  return NextResponse.json({ response: result.reply });
}
