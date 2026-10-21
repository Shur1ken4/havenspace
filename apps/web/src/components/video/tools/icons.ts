import { ChartPie, GalleryHorizontalEnd, Gauge, Heart, PenLine } from "lucide-react";
import type { ToolKind } from "@/lib/tools/model";

/** One icon per therapy tool, used in the call and on the client's card. */
export const TOOL_ICONS: Record<ToolKind, typeof Gauge> = { scale: Gauge, balance: ChartPie, emotions: Heart, cards: GalleryHorizontalEnd, board: PenLine };
