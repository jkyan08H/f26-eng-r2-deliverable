"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import type { Database } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import {
  describeSaveError,
  emptyToNull,
  kingdoms,
  populationFromInput,
  speciesSchema,
  type SpeciesFormData,
} from "./species-schema";

type Species = Database["public"]["Tables"]["species"]["Row"];

export default function EditSpeciesDialog({ species }: { species: Species }) {
  const router = useRouter();

  // Controlled so the form can be re-seeded from props whenever the dialog opens.
  const [open, setOpen] = useState<boolean>(false);

  // Unlike the "Add species" form, the defaults are the row being edited rather than empty values.
  // Nullable columns are passed through as null rather than "" for the reason given in
  // add-species-dialog.tsx: this is a controlled form, and undefined/"" mismatches raise warnings.
  const defaultValues: SpeciesFormData = {
    scientific_name: species.scientific_name,
    common_name: species.common_name,
    kingdom: species.kingdom,
    total_population: species.total_population,
    image: species.image,
    description: species.description,
  };

  const form = useForm<SpeciesFormData>({
    resolver: zodResolver(speciesSchema),
    defaultValues,
    mode: "onChange",
  });

  // Read during render on purpose. react-hook-form's formState is a Proxy that only subscribes the
  // component to the fields it sees touched while rendering, so reading form.formState.isDirty
  // inside the callback below would never subscribe and the guard would silently never fire.
  const { isDirty } = form.formState;

  const handleOpenChange = (nextOpen: boolean) => {
    // Re-seed on every open so an abandoned draft never reappears later, and so the form reflects
    // any change that has landed since this card was first rendered.
    if (nextOpen) form.reset(defaultValues);
    setOpen(nextOpen);
  };

  const onSubmit = async (input: SpeciesFormData) => {
    const supabase = createBrowserSupabaseClient();

    // `.select()` is load-bearing, not decoration. Without it supabase-js sends
    // `Prefer: return=minimal` and resolves with { data: null, error: null } even when the UPDATE
    // matched no rows at all. The species policy is `for update using (auth.uid() = author)`, so a
    // row this user does not own is simply invisible to the statement -- Postgres skips it and
    // raises nothing. Asking for the updated rows back is what distinguishes a real save from one
    // that was silently discarded, which would otherwise show a success toast and change nothing.
    //
    // `author` and `id` are deliberately absent from the payload. A BEFORE UPDATE trigger raises
    // 'changing species author is not allowed', and a species' identity is not the user's to edit.
    const { data, error } = await supabase
      .from("species")
      .update({
        common_name: input.common_name,
        description: input.description,
        kingdom: input.kingdom,
        scientific_name: input.scientific_name,
        total_population: input.total_population,
        image: input.image,
      })
      .eq("id", species.id)
      .select();

    if (error) {
      return toast({
        title: "Something went wrong.",
        description: describeSaveError(error, input.scientific_name),
        variant: "destructive",
      });
    }

    if (data.length === 0) {
      return toast({
        title: "Nothing was saved.",
        description: "A species can only be edited by the person who added it. Try reloading the page.",
        variant: "destructive",
      });
    }

    // Reset to the values zod produced rather than the ones typed, so that if this form is reopened
    // before the server components refresh, it shows what was actually stored (trimmed, nulled).
    form.reset(input);

    setOpen(false);

    // Species are fetched in species/page.tsx, a server component. Refreshing the route re-runs that
    // fetch and re-renders the card with the updated row.
    router.refresh();

    return toast({
      title: "Species updated!",
      description: "Successfully updated " + input.scientific_name + ".",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          Edit
          {/* One card renders per species, so without this suffix a screen reader's element list
              would show a dozen identical "Edit" buttons. */}
          <span className="sr-only">{` ${species.scientific_name}`}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-screen overflow-y-auto sm:max-w-[600px]"
        onInteractOutside={(event) => {
          // A click on the overlay while there are unsaved changes is almost always a misclick, so
          // it is ignored. Escape and Cancel are deliberate gestures and still close the dialog --
          // discarding the draft, which reopening then re-seeds from the saved row.
          if (isDirty) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit Species</DialogTitle>
          <DialogDescription>
            Update the details for this species. Click &quot;Save changes&quot; below when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e: BaseSyntheticEvent) => void form.handleSubmit(onSubmit)(e)}>
            <div className="grid w-full items-center gap-4">
              <FormField
                control={form.control}
                name="scientific_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scientific Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Cavia porcellus" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="common_name"
                render={({ field }) => {
                  // We must extract value from field and convert a potential defaultValue of `null` to "" because inputs can't handle null values: https://github.com/orgs/react-hook-form/discussions/4091
                  const { value, onChange, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Common Name</FormLabel>
                      <FormControl>
                        <Input
                          value={value ?? ""}
                          placeholder="Guinea pig"
                          {...rest}
                          onChange={(event) => onChange(emptyToNull(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="kingdom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kingdom</FormLabel>
                    <Select onValueChange={(value) => field.onChange(kingdoms.parse(value))} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a kingdom" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {kingdoms.options.map((kingdom, index) => (
                            <SelectItem key={index} value={kingdom}>
                              {kingdom}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total_population"
                render={({ field }) => {
                  const { value, onChange, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Total population</FormLabel>
                      <FormControl>
                        {/* Using shadcn/ui form with number: https://github.com/shadcn-ui/ui/issues/421 */}
                        <Input
                          type="number"
                          value={value ?? ""}
                          placeholder="300000"
                          {...rest}
                          onChange={(event) => onChange(populationFromInput(event.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Leave blank if the population is unknown.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => {
                  // We must extract value from field and convert a potential defaultValue of `null` to "" because inputs can't handle null values: https://github.com/orgs/react-hook-form/discussions/4091
                  const { value, onChange, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input
                          value={value ?? ""}
                          placeholder="https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/George_the_amazing_guinea_pig.jpg/440px-George_the_amazing_guinea_pig.jpg"
                          {...rest}
                          onChange={(event) => onChange(emptyToNull(event.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Clear this field to remove the image.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => {
                  // We must extract value from field and convert a potential defaultValue of `null` to "" because textareas can't handle null values: https://github.com/orgs/react-hook-form/discussions/4091
                  const { value, onChange, ...rest } = field;
                  return (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          value={value ?? ""}
                          placeholder="The guinea pig or domestic guinea pig, also known as the cavy or domestic cavy, is a species of rodent belonging to the genus Cavia in the family Caviidae."
                          {...rest}
                          onChange={(event) => onChange(emptyToNull(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <div className="flex">
                <Button type="submit" className="ml-1 mr-1 flex-auto">
                  Save changes
                </Button>
                {/* Not DialogClose: closing has to go through handleOpenChange so the draft is
                    discarded and re-seeded consistently, whichever way the dialog is dismissed. */}
                <Button
                  type="button"
                  className="ml-1 mr-1 flex-auto"
                  variant="secondary"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
