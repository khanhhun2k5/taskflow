"use client";

import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { useRef, type RefObject } from "react";
import { locate, type ColumnOrder } from "@/features/boards/domain/drop";
import type { BoardDTO } from "@/features/boards/schemas";

/**
 * Localized live-region messages for drag and drop (NFR-21, docs/06 section 4.4):
 * "Đã nhặt Viết báo cáo. Đang ở cột Đang làm, vị trí 2 trên 4."
 * `order` is the column order while dragging (draft), read when each event fires.
 */
export function useBoardAnnouncements(board: BoardDTO, order: RefObject<ColumnOrder[]>) {
  const t = useTranslations("Dnd");
  const titles = new Map(
    board.columns.flatMap((c) => c.tasks.map((task) => [task.id, task.title])),
  );
  const names = new Map(board.columns.map((c) => [c.id, c.name]));
  // dnd-kit also fires "over" for the card's own spot right after pick-up; announcing that
  // would replace "Picked up …". Only speak when the position really changes.
  const last = useRef("");

  function where(id: string) {
    const found = locate(order.current, id);
    const column = order.current.find((c) => c.id === found?.columnId);
    return {
      title: titles.get(id) ?? "",
      column: names.get(found?.columnId ?? "") ?? "",
      position: (found?.index ?? 0) + 1,
      total: column?.taskIds.length ?? 0,
    };
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const at = where(String(active.id));
      last.current = `${at.column}:${at.position}`;
      return t("picked", at);
    },
    onDragOver: ({ active, over }) => {
      const at = where(String(active.id));
      const key = `${at.column}:${at.position}`;
      if (!over || key === last.current) return undefined;
      last.current = key;
      return t("over", at);
    },
    onDragEnd: ({ active, over }) =>
      over ? t("dropped", where(String(active.id))) : t("cancelled", where(String(active.id))),
    onDragCancel: ({ active }) => t("cancelled", where(String(active.id))),
  };
  const screenReaderInstructions: ScreenReaderInstructions = { draggable: t("instructions") };
  return { announcements, screenReaderInstructions };
}
