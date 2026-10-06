import { NextRequest, NextResponse } from "next/server";
import { notion, isNotionConfigured } from "@/lib/notion";
import {
  findPropNames,
  mapNotionRows,
  todayISO,
} from "@/lib/events";

type NotionClient = NonNullable<typeof notion>;
type Direction = "initial" | "future" | "past";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/**
 * Notion Database 페이지네이션 API
 *
 * GET /api/notion?databaseId=...&direction=initial|future|past
 *   &pageSize=20
 *   &cursor=...          (future/past 연속 조회)
 *   &before=YYYY-MM-DD   (past: 이 날짜 이전만)
 *   &after=YYYY-MM-DD    (future 시작점, 기본 today)
 */
export async function GET(request: NextRequest) {
  if (!isNotionConfigured() || !notion) {
    return NextResponse.json(
      {
        error: "NOTION_API_KEY가 설정되지 않았습니다. .env에 추가하세요.",
      },
      { status: 503 }
    );
  }

  const client = notion as NotionClient;
  const searchParams = request.nextUrl.searchParams;
  const databaseId = searchParams.get("databaseId");

  if (!databaseId) {
    return NextResponse.json(
      { error: "databaseId 쿼리 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const direction = (searchParams.get("direction") ?? "initial") as Direction;
  const cursor = searchParams.get("cursor");
  const beforeParam = searchParams.get("before");
  const afterParam = searchParams.get("after");

  const pageSize = Math.min(
    Math.max(Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE
  );

  if (!["initial", "future", "past"].includes(direction)) {
    return NextResponse.json(
      { error: "direction은 initial | future | past 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  if (direction === "past" && !beforeParam) {
    return NextResponse.json(
      { error: "past 조회에는 before(YYYY-MM-DD)가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const database = await client.databases.retrieve({
      database_id: databaseId,
    });
    const properties = (database as any).properties ?? {};
    const { titleProp, dateProp } = findPropNames(properties);

    if (!dateProp) {
      return NextResponse.json(
        { error: "날짜(date) 속성이 있는 Notion DB가 필요합니다." },
        { status: 400 }
      );
    }

    let filter: any;
    let sortDirection: "ascending" | "descending" = "ascending";

    if (direction === "past") {
      sortDirection = "descending";
      filter = {
        property: dateProp,
        date: { before: beforeParam! },
      };
    } else {
      // initial / future: 오늘(또는 after) 이후
      let afterDate = todayISO();
      if (afterParam === "today") {
        afterDate = todayISO();
      } else if (afterParam && /^\d{4}-\d{2}-\d{2}/.test(afterParam)) {
        afterDate = afterParam.slice(0, 10);
      }

      filter = {
        property: dateProp,
        date: { on_or_after: afterDate },
      };
      sortDirection = "ascending";
    }

    const response = await client.databases.query({
      database_id: databaseId,
      page_size: pageSize,
      filter,
      sorts: [
        {
          property: dateProp,
          direction: sortDirection,
        },
      ],
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    let events = mapNotionRows(response.results ?? [], titleProp, dateProp);

    // past는 최신→과거 순으로 오므로, 화면용으로 오름차순 뒤집기
    if (direction === "past") {
      events = events.reverse();
    }

    return NextResponse.json({
      events,
      hasMore: response.has_more ?? false,
      nextCursor: response.next_cursor ?? null,
      direction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Notion 데이터베이스 조회 중 오류가 발생했습니다: " + message,
      },
      { status: 500 }
    );
  }
}
