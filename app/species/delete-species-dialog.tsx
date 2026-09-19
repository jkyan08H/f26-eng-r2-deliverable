"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import type { Database } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Species = Database["public"]["Tables"]["species"]["Row"];

export default function DeleteSpeciesDialog({ species }: { species: Species }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  // Controlled so a successful delete closes the dialog explicitly. Leaving it uncontrolled
  // would rely on router.refresh() unmounting the card out from under its own dialog, which
  // happens to work but leaves the dialog stranded if the refresh is slow or fails.
  const [open, setOpen] = useState(false);

  const onDelete = async () => {
    setIsDeleting(true);
    const supabase = createBrowserSupabaseClient();

    // `.select()` for the same reason as the edit dialog: the "Users can delete their created
    // species" policy filters rows the caller does not own, so a delete that matches nothing comes
    // back as { data: null, error: null } and would otherwise report a success that never happened.
    const { data, error } = await supabase.from("species").delete().eq("id", species.id).select();

    setIsDeleting(false);

    if (error) {
      return toast({ title: "Something went wrong.", description: error.message, variant: "destructive" });
    }

    if (data.length === 0) {
      return toast({
        title: "Nothing was deleted.",
        description: "A species can only be deleted by the person who added it. Try reloading the page.",
        variant: "destructive",
      });
    }

    setOpen(false);

    // The list is fetched in the species/page.tsx server component, so refreshing the route is what
    // removes the card. There is no local list state to keep in sync.
    router.refresh();

    return toast({
      title: "Species deleted.",
      description: `Successfully deleted ${species.scientific_name}.`,
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {/* Destructive styling on the trigger sets the expectation before the dialog opens, rather
            than surprising the user with a red confirm button after they have already clicked. */}
        <Button variant="destructive" className="w-full">
          Delete
          <span className="sr-only">{` ${species.scientific_name}`}</span>
        </Button>
      </AlertDialogTrigger>
      {/* AlertDialog rather than Dialog: deleting cannot be undone, so this is exactly the case
          Radix's alertdialog role exists for. It also focuses Cancel rather than the destructive
          action, and ignores outside clicks, so neither a stray click nor a reflexive Enter deletes
          a record. */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this species?</AlertDialogTitle>
          <AlertDialogDescription>
            {/* Naming the record is what makes the confirmation meaningful -- a generic "are you
                sure?" is clicked through without being read. */}
            <span className="font-medium italic">{species.scientific_name}</span>
            {species.common_name ? ` (${species.common_name})` : ""} will be permanently removed from Biodiversity Hub.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Radix closes the dialog on action by default. Preventing that keeps it open while
              // the request is in flight, so a failure can be reported against the record in view
              // instead of against a dialog that has already vanished.
              event.preventDefault();
              void onDelete();
            }}
            disabled={isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
