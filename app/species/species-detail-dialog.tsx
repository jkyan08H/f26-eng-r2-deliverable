"use client";
/*
Radix's Dialog keeps its open/closed state in React state and shares it with the trigger and content
through context, so this component cannot render on the server. The directive is required here, not
merely inherited from SpeciesCard.
*/
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";
import type { SpeciesWithAuthor } from "./species-schema";

// Allocated once at module scope rather than per render. The locale is pinned so that digit
// grouping cannot differ between the server render and the client hydration.
const populationFormatter = new Intl.NumberFormat("en-US");

/**
 * Formats a population for display, or returns null when there is no recorded value.
 *
 * The null check is explicit rather than a truthiness check: 0 is a meaningful population for a
 * species that is extinct in the wild, and must read as "0" rather than as missing data.
 */
function formatPopulation(totalPopulation: number | null): string | null {
  return totalPopulation === null ? null : populationFormatter.format(totalPopulation);
}

/**
 * One labelled datum in the dialog's description list. A wrapping <div> is valid between <dl> and
 * its <dt>/<dd> pair in HTML5, and it keeps each pair together as a single grid cell.
 */
function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      {/* A missing value is rendered as visible text rather than as an empty <dd>: blank space is
          indistinguishable from a rendering bug for a sighted reader, and a screen reader skips an
          empty <dd> entirely, so the field would silently disappear from the list. */}
      <dd className={value === null ? "italic text-muted-foreground" : "font-medium"}>{value ?? "Not recorded"}</dd>
    </div>
  );
}

export default function SpeciesDetailDialog({ species }: { species: SpeciesWithAuthor }) {
  return (
    // Left uncontrolled deliberately: this view is read-only, so nothing needs to close the dialog
    // programmatically. Editing lives in its own dialog (edit-species-dialog.tsx), which does
    // control its open state because it has to re-seed the form each time it opens.
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full">
          Learn More
          {/* One card renders per species, so a dozen buttons all named "Learn More" are
              indistinguishable in a screen reader's element list. This visually hidden suffix makes
              each accessible name unique without changing the visual design. Radix supplies the
              trigger's aria-haspopup, aria-expanded and aria-controls. */}
          <span className="sr-only">{` about ${species.scientific_name}`}</span>
        </Button>
      </DialogTrigger>

      {/* DialogContent is already `grid`, so pinning the header and footer needs only an explicit
          row template -- no display override, and therefore no reliance on tailwind-merge to
          resolve a `flex` vs `grid` conflict. `minmax(0,1fr)` is what allows the middle row to
          shrink below its content height and actually produce a scrollbar.
          `p-0` moves padding onto the individual rows so the divider lines can run edge to edge,
          and `overflow-hidden` keeps those rows inside the rounded corners.
          The height cap uses `vh` rather than `dvh` on purpose: the base DialogContent sets no
          max-height at all, so a `dvh` value that an older engine fails to parse would leave the
          dialog completely uncapped. 85% also leaves enough slack for mobile browser chrome. */}
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        {/* `text-left` overrides DialogHeader's mobile centering -- this reads as a document
            heading, and centred text would sit visibly off-centre beside the close button anyway.
            `pr-12` reserves room for that button, which DialogContent positions at right-4 top-4. */}
        <DialogHeader className="space-y-1 border-b p-6 pr-12 text-left">
          {/* Italic because binomial names are italicised by convention. `break-words` stops an
              unusually long name from forcing the dialog wider than the viewport. Sized to match
              the card's <h3> so the name does not shrink when the detail view opens. */}
          <DialogTitle className="break-words text-2xl italic">{species.scientific_name}</DialogTitle>
          {/* The common name lives here and only here. Radix points aria-describedby at
              DialogDescription, so this is announced immediately after the title on open -- and a
              short common name is the right length for that, where the free-text description would
              not be. Rendering it a second time in the list below would make a screen reader
              announce it twice. It is always rendered so the aria-describedby target cannot dangle. */}
          <DialogDescription className="text-base">
            {species.common_name ?? <span className="italic">No common name recorded</span>}
          </DialogDescription>
        </DialogHeader>

        {/* The scroll container is focusable by design. Radix moves focus to DialogContent on open,
            but DialogContent is no longer the scrolling element, so without a tab stop here a
            keyboard-only user could not scroll a long description in Chrome or Safari. The cost is
            one extra tab stop when the content happens to be short; measuring overflow to avoid
            that would need a ResizeObserver, which is not worth the complexity at this size.
            `overscroll-contain` stops a flick at the end of the list from scrolling the page
            behind the overlay. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Species details"
          className="space-y-6 overflow-y-auto overscroll-contain p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {species.image && (
            /* `object-contain` here, where the card uses `cover`: the card crops to keep the grid
               tidy, but this is where a reader actually looks at the organism, so the whole frame
               is shown. When there is no image the block collapses rather than reserving dead
               space. No `sizes` prop -- next.config.js sets `images.unoptimized`, so next/image
               emits a plain <img> with no srcset and `sizes` would be inert. */
            <div className="relative h-56 w-full overflow-hidden rounded-md border bg-muted sm:h-64">
              <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "contain" }} />
            </div>
          )}

          {/* A description list rather than a table or stacked paragraphs: these are label/value
              pairs, and the semantics let a screen reader announce "Kingdom, Animalia" as one unit.
              Two fields fill the two-column layout evenly once there is room for it. */}
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField label="Kingdom" value={species.kingdom} />
            <DetailField label="Total population" value={formatPopulation(species.total_population)} />
          </dl>

          <section>
            {/* The one piece of long-form content gets its own section rather than another <dl>
                cell, so it is not typographically equal to a one-word value like "Animalia".
                <h3> because DialogTitle renders an <h2>, and aria-modal hides the rest of the page,
                so the dialog's own heading order is what a screen reader navigates. */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Description</h3>
            {species.description ? (
              // `whitespace-pre-line` preserves the line breaks an author typed into the textarea
              // without resorting to dangerouslySetInnerHTML; `break-words` contains pasted URLs.
              <p className="whitespace-pre-line break-words leading-7">{species.description}</p>
            ) : (
              <p className="italic text-muted-foreground">No description recorded</p>
            )}
          </section>

          {/* Kept out of the <dl> above deliberately. Kingdom and population are facts about the
              organism; the author is provenance for the record, so it reads as an attribution line
              under the entry rather than as another equal field. `profiles` is null when the
              related row is not visible, in which case the block is simply omitted rather than
              rendering "Added by unknown". */}
          {species.profiles && (
            <section className="border-t pt-4">
              <h3 className="text-sm font-medium text-muted-foreground">Added by</h3>
              <p className="mt-1 font-medium">{species.profiles.display_name}</p>
              {/* The email is already public to every signed-in user through the profiles table's
                  "viewable by everyone" policy, so showing it here reveals nothing new -- but it is
                  the contact path a researcher would actually want for a questionable entry. */}
              <p className="text-sm text-muted-foreground">{species.profiles.email}</p>
              {species.profiles.biography && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{species.profiles.biography}</p>
              )}
            </section>
          )}
        </div>

        {/* The built-in X is a 16px target in the corner. An explicit Close button, full width on
            small screens, gives touch users a comfortable target and keyboard users an exit they
            can reach by Tab rather than only by Escape. This row is also where Feature 2's Edit
            action will sit. */}
        <DialogFooter className="border-t p-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="w-full sm:w-auto">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
