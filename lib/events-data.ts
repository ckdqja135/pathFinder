import { mockEvents } from "@/data/mockEvents";
import { isDbConfigured, prisma } from "@/lib/db";
import type {
  CareerEvent,
  Category as CategoryEnum,
  EventType as EventTypeEnum,
} from "@/lib/types";

interface QueryOptions {
  categories?: CategoryEnum[];
  types?: EventTypeEnum[];
  query?: string;
}

function applyClientFilters(
  events: CareerEvent[],
  { categories, types, query }: QueryOptions,
): CareerEvent[] {
  const q = query?.trim().toLowerCase();
  return events.filter((e) => {
    if (categories?.length && !categories.includes(e.category)) return false;
    if (types?.length && !types.includes(e.type)) return false;
    if (q) {
      const haystack = `${e.title} ${e.organizer} ${e.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function rowToCareerEvent(row: {
  id: string;
  title: string;
  category: CategoryEnum;
  type: EventTypeEnum;
  startDate: Date;
  endDate: Date;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  organizer: string;
  location: string;
  isOnline: boolean;
  fee: number;
  link: string;
  description: string;
}): CareerEvent {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    type: row.type,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    registrationStart: row.registrationStart?.toISOString(),
    registrationEnd: row.registrationEnd?.toISOString(),
    organizer: row.organizer,
    location: row.location,
    isOnline: row.isOnline,
    fee: row.fee,
    link: row.link,
    description: row.description,
  };
}

export async function getAllEvents(
  opts: QueryOptions = {},
): Promise<CareerEvent[]> {
  if (!isDbConfigured) {
    return applyClientFilters(mockEvents, opts);
  }
  try {
    const rows = await prisma.event.findMany({
      where: {
        ...(opts.categories?.length
          ? { category: { in: opts.categories } }
          : {}),
        ...(opts.types?.length ? { type: { in: opts.types } } : {}),
        ...(opts.query
          ? {
              OR: [
                { title: { contains: opts.query, mode: "insensitive" } },
                { organizer: { contains: opts.query, mode: "insensitive" } },
                { description: { contains: opts.query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { startDate: "asc" },
    });
    return rows.map(rowToCareerEvent);
  } catch (err) {
    console.error("[events] DB query failed, falling back to mock:", err);
    return applyClientFilters(mockEvents, opts);
  }
}
