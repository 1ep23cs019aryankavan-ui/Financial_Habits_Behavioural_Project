import { RULE_CATALOGUE, type RuleKey } from "@/lib/constants";
import { titleCase } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function DecisionMeta({
  reason,
  emotionalState,
  urgency,
  essential,
  notes,
  flaggedRules,
}: {
  reason: string;
  emotionalState: string;
  urgency: string;
  essential: boolean;
  notes: string | null;
  flaggedRules: string[];
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Reason given
        </p>
        <p className="mt-1 leading-relaxed">{reason}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Feeling</dt>
          <dd className="font-medium">{titleCase(emotionalState)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Urgency</dt>
          <dd className="font-medium">{titleCase(urgency)}</dd>
        </div>
      </dl>

      <div>
        <p className="text-xs text-muted-foreground">Essential</p>
        <p className="font-medium">{essential ? "Yes" : "No — treated as a want"}</p>
      </div>

      {notes && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {notes}
          </p>
        </div>
      )}

      {flaggedRules.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rules that fired
          </p>
          <ul className="space-y-2">
            {flaggedRules.map((key) => (
              <li key={key} className="text-xs leading-relaxed text-muted-foreground">
                <Badge variant="danger" className="mr-1.5">
                  {RULE_CATALOGUE[key as RuleKey]?.name ?? key}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
