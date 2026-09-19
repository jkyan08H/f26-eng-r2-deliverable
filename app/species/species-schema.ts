import type { Database } from "@/lib/schema";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

/*
The validation contract for a species is shared by the "Add species" and "Edit species" forms, so it
lives here rather than inside either dialog. Two copies would be two places for the rules to drift,
and the `image` and `total_population` rules are exactly the ones that needed correcting.
*/

// Kingdom options. Used both to validate a submission and to render the Select's items, which is
// why it is a zod enum rather than a plain array: `kingdoms.options` gives the list for the UI.
export const kingdoms = z.enum(["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"]);

// Use Zod to define the shape + requirements of a Species entry; used in form validation.
export const speciesSchema = z.object({
  scientific_name: z
    .string()
    .trim()
    .min(1, { message: "Scientific name is required." })
    .transform((val) => val?.trim()),
  common_name: z
    .string()
    .nullable()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  kingdom: kingdoms,
  // `.max` matches the int4 column in setup.sql. Without it, zod accepts a value Postgres cannot
  // store, so the overflow is only discovered on save and arrives as a raw
  // 'value "9999999999" is out of range for type integer'. Bounding it here fails in the field
  // instead, next to the input the user has to correct. (`.min(1)` was redundant beside
  // `.positive()` for an integer, and made zod emit two messages for the same mistake.)
  total_population: z
    .number()
    .int()
    .positive()
    .max(2_147_483_647, { message: "Total population must be 2,147,483,647 or less." })
    .nullable(),
  image: z
    .string()
    .url({ message: "Enter a full image URL, for example https://example.com/photo.jpg" })
    .nullable()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  description: z
    .string()
    .nullable()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
});

export type SpeciesFormData = z.infer<typeof speciesSchema>;

/**
 * Maps a cleared text input to null before it reaches validation.
 *
 * The nullable fields above validate *before* they transform, so an empty string reaches `.url()`
 * and fails with an "invalid url" message instead of being understood as "no image". Normalising at
 * the input boundary means a cleared field arrives as `null`, which `.nullable()` accepts and
 * short-circuits. Without this, an image URL that has already been saved cannot be removed.
 */
export function emptyToNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/**
 * Maps a number input's value to a population count, or to null when the field is cleared.
 *
 * The starter code used `+event.target.value`, but `+"" === 0` and the schema requires a positive
 * integer, so clearing the field failed with "Number must be greater than 0" and a population that
 * had already been recorded could never be removed. An empty field means "unknown", not "zero" --
 * and 0 stays meaningful for a species that is extinct in the wild.
 */
export function populationFromInput(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

/*
Postgres SQLSTATEs that can reach a user through a save. PostgREST passes the database's own error
code through untouched as `error.code`, so these are matched exactly rather than by sniffing the
message text.
*/
const UNIQUE_VIOLATION = "23505";
const NUMERIC_OUT_OF_RANGE = "22003";

/**
 * Turns a failed save into something the user can act on.
 *
 * A raw Postgres message names the database constraint rather than the field the user typed in --
 * 'duplicate key value violates unique constraint "species_scientific_name_key"' tells a researcher
 * nothing about what to change. Both the add and the edit form route their failures through here, so
 * that the same underlying problem cannot read two different ways depending on which dialog the user
 * happens to be in.
 */
export function describeSaveError(error: PostgrestError, scientificName: string): string {
  switch (error.code) {
    case UNIQUE_VIOLATION:
      return `A species with the scientific name "${scientificName}" already exists.`;
    case NUMERIC_OUT_OF_RANGE:
      // Should be unreachable now that the schema bounds total_population, but a value that slips
      // past client-side validation still gets a message that names the field rather than the type.
      return "That total population is too large to store. Enter a value up to 2,147,483,647.";
    default:
      return error.message;
  }
}

/**
 * A species row with its author's profile attached.
 *
 * `species.author` holds only a user id, so the detail view joins the matching profile in the same
 * query rather than firing one request per card. Supabase embeds the related row under the table
 * name; it is a single object rather than an array because the foreign key is many-to-one, and it
 * is nullable because an embedded resource resolves to null when no matching row is visible.
 */
export type SpeciesWithAuthor = Database["public"]["Tables"]["species"]["Row"] & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "display_name" | "email" | "biography"> | null;
};
