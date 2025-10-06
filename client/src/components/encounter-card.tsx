import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MapPin, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import type { Encounter } from "@shared/schema";

interface EncounterCardProps {
  encounter: Encounter;
  onClick?: () => void;
}

export function EncounterCard({ encounter, onClick }: EncounterCardProps) {
  const encounterDate = new Date(encounter.datetime);

  return (
    <Card
      className={`hover-elevate transition-all duration-200 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      data-testid={`card-encounter-${encounter.id}`}
    >
      <CardHeader className="pb-3">
        <h3 className="text-lg font-semibold text-foreground" data-testid="text-encounter-name">
          {encounter.name}
        </h3>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <span className="truncate" data-testid="text-encounter-location">{encounter.location}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span data-testid="text-encounter-date">{format(encounterDate, "MMMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span data-testid="text-encounter-time">{format(encounterDate, "h:mm a")}</span>
        </div>
        {encounter.context && (
          <p className="text-sm text-foreground mt-3 line-clamp-2" data-testid="text-encounter-context">
            {encounter.context}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
