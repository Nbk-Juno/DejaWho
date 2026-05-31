import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Calendar, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EncounterDetailSheet } from "@/components/encounter-detail-sheet";
import { useAnimatedSheetClose } from "@/hooks/use-animated-sheet-close";
import { apiRequest } from "@/lib/queryClient";
import { formatAiErrorTitle } from "@/lib/ai-error";
import { useToast } from "@/hooks/use-toast";
import { encounterFullName, personDisplayName, type ApiEncounter, type ApiPerson } from "@shared/schema";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

type PersonDetail = {
  person: ApiPerson;
  encounters: ApiEncounter[];
};

function EncounterRow({
  encounter,
  onOpen,
}: {
  encounter: ApiEncounter;
  onOpen: (encounter: ApiEncounter) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(encounter)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(encounter);
        }
      }}
      className="rounded-xl bg-white/[0.07] border border-white/10 p-4 space-y-2 cursor-pointer hover:bg-white/[0.09] active:bg-white/[0.11] transition-colors"
    >
      <p className="text-white font-medium text-sm">{encounterFullName(encounter)}</p>
      <div className="flex items-center gap-2 text-white/50 text-xs">
        <MapPin className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{encounter.location}</span>
      </div>
      <div className="flex items-center gap-2 text-white/50 text-xs">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span>{format(new Date(encounter.datetime), "MMM d, yyyy · h:mm a")}</span>
      </div>
      {encounter.context && (
        <div>
          <p className={["text-white/60 text-xs leading-relaxed", expanded ? "" : "line-clamp-2"].join(" ")}>
            {encounter.context}
          </p>
          {encounter.context.length > 120 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="flex items-center gap-1 text-white/40 text-xs mt-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Less" : "More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCardContent({
  detail,
  onOpenEncounter,
  onEdit,
  onRequestDelete,
}: {
  detail: PersonDetail;
  onOpenEncounter: (encounter: ApiEncounter) => void;
  onEdit: () => void;
  onRequestDelete: () => void;
}) {
  const { person, encounters } = detail;
  const lastSeen = encounters.length > 0
    ? format(new Date(encounters[0].datetime), "MMM d, yyyy")
    : null;

  return (
    <div className="dw-content-in space-y-5">
      <div className="flex items-start justify-between gap-3 pr-10">
        <SheetHeader className="min-w-0 flex-1">
          <SheetTitle className="text-white text-left text-2xl font-semibold">
            {personDisplayName(person)}
          </SheetTitle>
          <SheetDescription className="text-white/50 text-left text-sm">
            {person.encounterCount} encounter{person.encounterCount !== 1 ? "s" : ""}
            {lastSeen ? ` · last seen ${lastSeen}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${personDisplayName(person)}`}
            data-testid="button-edit-person"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete ${personDisplayName(person)} and all encounters`}
            data-testid="button-delete-person"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dw-error/10 hover:bg-dw-error/20 text-dw-error text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {person.summary && (
        <div className="rounded-xl bg-dw-indigo/10 border border-dw-indigo/20 p-4">
          <p className="text-white/80 text-sm leading-relaxed">{person.summary}</p>
        </div>
      )}

      {!person.summary && person.encounterCount < 2 && (
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
          <p className="text-dw-fg-sec text-sm italic">
            Record at least two encounters to generate a summary
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-dw-fg-ter uppercase tracking-widest">
          Encounters
        </h3>
        {encounters.length > 0 ? (
          encounters.map((e) => <EncounterRow key={e.id} encounter={e} onOpen={onOpenEncounter} />)
        ) : (
          <p className="text-dw-fg-sec text-sm">No encounters found</p>
        )}
      </div>
    </div>
  );
}

function PersonEditMode({
  person,
  onCancel,
  onSaved,
}: {
  person: ApiPerson;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(titleCase(person.normalizedName));
  const [lastName, setLastName] = useState(person.lastName ?? "");

  const mutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Name is required");
      await apiRequest("PATCH", `/api/persons/${person.id}`, {
        name: trimmedName,
        lastName: lastName.trim(),
      });
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      onSaved();
    },
    onError: (err) => {
      toast({ title: formatAiErrorTitle(err, "Couldn't save — try again."), variant: "destructive" });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!mutation.isPending) mutation.mutate();
      }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between gap-3 pr-10">
        <button
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <SheetTitle className="text-white text-base font-semibold">Edit person</SheetTitle>
        <button
          type="submit"
          disabled={mutation.isPending}
          data-testid="button-save-person"
          className="px-4 py-1.5 rounded-full bg-dw-indigo hover:bg-dw-indigo/90 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold text-dw-fg-ter uppercase tracking-widest">
          Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-white/5 border-white/15 text-white focus-visible:ring-dw-indigo/50"
          autoCapitalize="words"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold text-dw-fg-ter uppercase tracking-widest">
          Last name
        </label>
        <Input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="bg-white/5 border-white/15 text-white focus-visible:ring-dw-indigo/50"
          autoCapitalize="words"
          autoComplete="off"
          placeholder="Optional"
        />
      </div>

      <p className="text-dw-fg-ter text-xs leading-relaxed">
        Updates every encounter with this person. A last name fills in on encounters that don't
        already have one.
      </p>
    </form>
  );
}

function PersonCardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 bg-white/10" />
        <Skeleton className="h-4 w-28 bg-white/10" />
      </div>
      <Skeleton className="h-20 w-full bg-white/10 rounded-xl" />
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function PersonCard({ personId, onClose }: { personId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openEncounterId, setOpenEncounterId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const { open, onOpenChange, closeThen } = useAnimatedSheetClose(onClose);

  const { data, isLoading, isError } = useQuery<PersonDetail>({
    queryKey: ["/api/persons", personId],
  });

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
    queryClient.invalidateQueries({ queryKey: ["/api/persons", personId] });
    queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
    setEditing(false);
  }

  const deleteMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/persons/${personId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
      toast({ title: "Person deleted" });
      setConfirmDelete(false);
      closeThen(onClose);
    },
    onError: () => {
      toast({ title: "Couldn't delete — try again.", variant: "destructive" });
    },
  });

  const personName = data ? personDisplayName(data.person) : "this person";
  const encounterCount = data?.person.encounterCount ?? 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-dw-overlay border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
        >
          {isLoading && <PersonCardSkeleton />}
          {isError && (
            <p className="text-dw-fg-sec text-sm text-center py-8">Failed to load — tap outside to close</p>
          )}
          {data && !editing && (
            <PersonCardContent
              detail={data}
              onOpenEncounter={(e) => setOpenEncounterId(e.id)}
              onEdit={() => setEditing(true)}
              onRequestDelete={() => setConfirmDelete(true)}
            />
          )}
          {data && editing && (
            <PersonEditMode
              person={data.person}
              onCancel={() => setEditing(false)}
              onSaved={handleSaved}
            />
          )}
        </SheetContent>
      </Sheet>

      {openEncounterId && (
        <EncounterDetailSheet
          encounterId={openEncounterId}
          onClose={() => setOpenEncounterId(null)}
        />
      )}

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!o && !deleteMutation.isPending) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {personName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes {personName} and all {encounterCount} encounter
              {encounterCount !== 1 ? "s" : ""} you've recorded with them. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="bg-dw-error text-white hover:bg-dw-error/90"
              data-testid="button-confirm-delete-person"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
