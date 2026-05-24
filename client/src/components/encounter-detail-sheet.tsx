import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, List, MapPin, Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { formatAiErrorTitle } from "@/lib/ai-error";
import { useToast } from "@/hooks/use-toast";
import { normalizePersonName, type ApiEncounter, type ApiPerson } from "@shared/schema";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format an ISO datetime for the <input type="datetime-local"> value attribute,
// which wants "YYYY-MM-DDTHH:MM" in the user's local timezone.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

type FormState = {
  name: string;
  location: string;
  datetimeLocal: string;
  context: string;
};

function ViewMode({
  encounter,
  onEdit,
  onOpenHistory,
}: {
  encounter: ApiEncounter;
  onEdit: () => void;
  onOpenHistory?: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 pr-10">
        <div className="space-y-1 min-w-0 flex-1">
          <SheetTitle className="text-white text-left text-2xl font-semibold leading-tight">
            {titleCase(encounter.name)}
          </SheetTitle>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              aria-label={`See encounter history for ${encounter.name}`}
              data-testid="button-open-person-history"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold transition-colors"
            >
              <List className="w-3.5 h-3.5" />
              History
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit encounter"
            data-testid="button-edit-encounter"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <MapPin className="w-4 h-4 flex-shrink-0 text-white/40" strokeWidth={2} />
          <span>{encounter.location}</span>
        </div>
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Calendar className="w-4 h-4 flex-shrink-0 text-white/40" strokeWidth={2} />
          <span>{format(new Date(encounter.datetime), "MMM d, yyyy · h:mm a")}</span>
        </div>
      </div>

      {encounter.context ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
            Notes
          </p>
          <p className="text-white/85 text-sm leading-relaxed whitespace-pre-wrap">
            {encounter.context}
          </p>
        </div>
      ) : (
        <p className="text-white/35 text-sm italic">No notes yet — tap Edit to add some.</p>
      )}
    </div>
  );
}

function EditMode({
  encounter,
  onCancel,
  onSaved,
}: {
  encounter: ApiEncounter;
  onCancel: () => void;
  onSaved: (updated: ApiEncounter) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    name: encounter.name,
    location: encounter.location,
    datetimeLocal: toLocalInput(encounter.datetime),
    context: encounter.context ?? "",
  });

  const mutation = useMutation<ApiEncounter, Error, void>({
    mutationFn: async () => {
      const trimmedName = form.name.trim();
      const trimmedLocation = form.location.trim();
      if (!trimmedName) throw new Error("Name is required");
      if (!trimmedLocation) throw new Error("Location is required");

      const body = {
        name: trimmedName,
        location: trimmedLocation,
        datetime: fromLocalInput(form.datetimeLocal),
        context: form.context.trim() || undefined,
      };
      const res = await apiRequest("PATCH", `/api/encounters/${encounter.id}`, body);
      return (await res.json()) as ApiEncounter;
    },
    onSuccess: (updated) => {
      toast({ title: "Saved" });
      onSaved(updated);
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
        <SheetTitle className="text-white text-base font-semibold">Edit encounter</SheetTitle>
        <button
          type="submit"
          disabled={mutation.isPending}
          data-testid="button-save-encounter"
          className="px-4 py-1.5 rounded-full bg-dw-indigo hover:bg-dw-indigo/90 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <Field label="Name">
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="bg-white/5 border-white/15 text-white focus-visible:ring-dw-indigo/50"
          autoCapitalize="words"
          autoComplete="off"
        />
      </Field>

      <Field label="Location">
        <Input
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          className="bg-white/5 border-white/15 text-white focus-visible:ring-dw-indigo/50"
          autoComplete="off"
        />
      </Field>

      <Field label="Date & time">
        <Input
          type="datetime-local"
          value={form.datetimeLocal}
          onChange={(e) => setForm((f) => ({ ...f, datetimeLocal: e.target.value }))}
          className="bg-white/5 border-white/15 text-white focus-visible:ring-dw-indigo/50"
        />
      </Field>

      <Field label="Notes">
        <Textarea
          value={form.context}
          onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
          rows={4}
          className="bg-white/5 border-white/15 text-white focus-visible:ring-dw-indigo/50 resize-none"
          placeholder="What stood out about this encounter?"
        />
      </Field>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48 bg-white/10" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-40 bg-white/10" />
        <Skeleton className="h-4 w-32 bg-white/10" />
      </div>
      <Skeleton className="h-24 w-full bg-white/10 rounded-xl" />
    </div>
  );
}

export function EncounterDetailSheet({
  encounterId,
  onClose,
  onOpenPerson,
}: {
  encounterId: string;
  onClose: () => void;
  /** When provided, the view mode shows a "History" pill that opens PersonCard for this
   * encounter's person. Omit when the sheet is already nested inside PersonCard. */
  onOpenPerson?: (personId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading, isError } = useQuery<ApiEncounter>({
    queryKey: ["/api/encounters", encounterId],
  });

  const { data: persons = [] } = useQuery<ApiPerson[]>({
    queryKey: ["/api/persons"],
    enabled: Boolean(onOpenPerson),
  });

  const personId = data
    ? persons.find((p) => p.normalizedName === normalizePersonName(data.name))?.id
    : undefined;
  const historyHandler = onOpenPerson && personId ? () => onOpenPerson(personId) : undefined;

  // Reset to view mode when the sheet opens for a different encounter.
  useEffect(() => {
    setEditing(false);
  }, [encounterId]);

  function handleSaved(updated: ApiEncounter) {
    queryClient.setQueryData(["/api/encounters", encounterId], updated);
    queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
    queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
    // If the name changed, the person detail (when opened from PersonCard) needs to refetch
    // since its summary references the old name.
    if (data && normalizePersonName(updated.name) !== normalizePersonName(data.name)) {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
    }
    setEditing(false);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-2xl bg-[#0D0744] border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        {isLoading && <DetailSkeleton />}
        {isError && (
          <p className="text-white/50 text-sm text-center py-8">
            Couldn't load that encounter — tap outside to close.
          </p>
        )}
        {data && !editing && (
          <ViewMode
            encounter={data}
            onEdit={() => setEditing(true)}
            onOpenHistory={historyHandler}
          />
        )}
        {data && editing && (
          <EditMode encounter={data} onCancel={() => setEditing(false)} onSaved={handleSaved} />
        )}
      </SheetContent>
    </Sheet>
  );
}
