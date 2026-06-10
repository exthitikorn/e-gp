import type { IngestStatusSearchParams } from "@/lib/egpIngestStatusShared";
import { StatusActiveFilterChips } from "./StatusActiveFilterChips";

type AgencyOption = { id: string; name: string };

type StatusActiveFiltersProps = {
  searchParams: IngestStatusSearchParams;
  agencies: AgencyOption[];
};

export function StatusActiveFilters({
  searchParams,
  agencies,
}: StatusActiveFiltersProps) {
  return (
    <StatusActiveFilterChips searchParams={searchParams} agencies={agencies} />
  );
}
