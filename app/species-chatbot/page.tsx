import { TypographyH2, TypographyP } from "@/components/ui/typography";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import ChatPanel from "./chat-panel";

/*
The chat UI needs hooks, so it has to be a client component -- and a client component cannot gate
itself, because anything it checks has already been sent to the browser. Splitting the route the way
settings/profile does (server page, client child) lets the session be checked on the server before
any of the interface is delivered.

This check is about what the page shows. The check that protects the OpenAI account is the one in
app/api/chat/route.ts, since an endpoint can be called without ever loading this page.
*/
export default async function SpeciesChatbotPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // this is a protected route - only users who are signed in can view this route
    redirect("/");
  }

  return (
    <>
      <TypographyH2>Species Chatbot</TypographyH2>
      <div className="mt-4 flex gap-4">
        <div className="mt-4 rounded-lg bg-foreground p-4 text-background">
          <TypographyP>
            The Species Chatbot answers questions about animals, including their habitat, diet, conservation status, and
            other natural-history details. Anything unrelated gets a polite reminder that it only handles
            species-related queries.
          </TypographyP>
          <TypographyP>
            Type your question below and press Enter to send, or Shift+Enter for a new line. Each question is answered
            on its own, so include any context you need in the message.
          </TypographyP>
        </div>
      </div>
      <ChatPanel />
    </>
  );
}
