export type Direction = "initial" | "future" | "past";

type BuildQueryArgs = {
  direction: Direction;
  dateProp: string;
  titleProp: string | null;
  titleQuery: string | null;
  beforeParam: string | null;
  afterParam: string | null;
  today: string;
};

export function buildNotionQuery({
  direction,
  dateProp,
  titleProp,
  titleQuery,
  beforeParam,
  afterParam,
  today,
}: BuildQueryArgs): {
  filter: any;
  sortDirection: "ascending" | "descending";
} {
  let dateFilter: any;
  let sortDirection: "ascending" | "descending" = "ascending";

  if (direction === "past") {
    sortDirection = "descending";
    dateFilter = {
      property: dateProp,
      date: { before: beforeParam! },
    };
  } else {
    let afterDate = today;
    if (afterParam === "today") {
      afterDate = today;
    } else if (afterParam && /^\d{4}-\d{2}-\d{2}/.test(afterParam)) {
      afterDate = afterParam.slice(0, 10);
    }

    dateFilter = {
      property: dateProp,
      date: { on_or_after: afterDate },
    };
    sortDirection = "ascending";
  }

  const filter =
    titleQuery && titleProp
      ? {
          and: [
            dateFilter,
            {
              property: titleProp,
              title: { equals: titleQuery },
            },
          ],
        }
      : dateFilter;

  return { filter, sortDirection };
}
