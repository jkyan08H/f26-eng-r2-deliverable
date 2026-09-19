"use client";
/*
Note: "use client" is a Next.js App Router directive that tells React to render the component as
a client component rather than a server component. This establishes the server-client boundary,
providing access to client-side functionality such as hooks and event handlers to this component and
any of its imported children. Although the SpeciesCard component itself does not use any client-side
functionality, it is beneficial to move it to the client because it is rendered in a list with a unique
key prop in species/page.tsx. When multiple component instances are rendered from a list, React uses the unique key prop
on the client-side to correctly match component state and props should the order of the list ever change.
React server components don't track state between rerenders, so leaving the uniquely identified components (e.g. SpeciesCard)
can cause errors with matching props and state in child components if the list order changes.
*/
import Image from "next/image";
import DeleteSpeciesDialog from "./delete-species-dialog";
import EditSpeciesDialog from "./edit-species-dialog";
import SpeciesDetailDialog from "./species-detail-dialog";
import type { SpeciesWithAuthor } from "./species-schema";

const SUMMARY_MAX_LENGTH = 150;

/**
 * Shortens a description for the card, appending an ellipsis only when text was actually removed.
 *
 * The original inline expression appended "..." unconditionally, so a 40-character description
 * rendered as though it had been cut short and promised more detail than the dialog would show.
 * Trimming before slicing also stops leading whitespace from consuming the character budget.
 */
function summarize(description: string | null): string | null {
  if (!description) return null;
  const trimmed = description.trim();
  if (trimmed.length <= SUMMARY_MAX_LENGTH) return trimmed;
  return trimmed.slice(0, SUMMARY_MAX_LENGTH).trimEnd() + "...";
}

/*
sessionId is the id of the currently signed-in user, fetched in the server component
species/page.tsx and threaded down rather than re-fetched here, so the card never has to trust a
client-side notion of who is logged in.
*/
export default function SpeciesCard({ species, sessionId }: { species: SpeciesWithAuthor; sessionId: string }) {
  const summary = summarize(species.description);

  return (
    // `flex flex-col` so the action row can be pushed to the bottom with `mt-auto`: cards in a
    // wrapped row have unequal heights (an absent image or a short description), and without this
    // the "Learn More" buttons sit at ragged heights across the row.
    <div className="m-4 flex w-72 min-w-72 flex-none flex-col rounded border-2 p-3 shadow">
      {species.image && (
        <div className="relative h-40 w-full">
          <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
        </div>
      )}
      <h3 className="mt-3 text-2xl font-semibold">{species.scientific_name}</h3>
      {/* Rendered conditionally: common_name is nullable, and an unconditional <h4> puts an empty
          heading into the accessibility tree and leaves a dead gap in the card. */}
      {species.common_name && <h4 className="text-lg font-light italic">{species.common_name}</h4>}
      {summary && <p>{summary}</p>}
      {/* Each dialog owns its own trigger, mirroring how AddSpeciesDialog owns its own trigger
          button, so a trigger can never drift out of sync with the dialog it opens. */}
      {/* "Learn More" spans the card because every visitor can use it; the owner-only actions pair
          on a second row beneath. Three buttons on one row squeezed "Learn More" onto two lines and
          made the destructive action as prominent as the primary one. */}
      <div className="mt-auto space-y-2 pt-3">
        <SpeciesDetailDialog species={species} />
        {/* Edit and delete are offered only for the viewer's own species. This is a usability gate,
            not a security one: the row-level security policies in setup.sql are what actually
            enforce authorship, and they still reject an update or delete from anyone else even if
            these controls were forced into the page. Hidden rather than disabled, because no one
            can ever become the author of someone else's species. */}
        {species.author === sessionId && (
          <div className="flex gap-2">
            <EditSpeciesDialog species={species} />
            <DeleteSpeciesDialog species={species} />
          </div>
        )}
      </div>
    </div>
  );
}
