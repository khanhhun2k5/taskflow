"use client";

import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  dropTargetFromOver,
  locate,
  moveInColumns,
  planDrop,
  type ColumnOrder,
} from "@/features/boards/domain/drop";
import { usePendingMoves } from "@/features/boards/hooks";
import type { BoardDTO } from "@/features/boards/schemas";
import { queryKeys } from "@/features/query-keys";
import { useMoveTask } from "@/features/tasks/hooks";

const toOrder = (board: BoardDTO): ColumnOrder[] =>
  board.columns.map((column) => ({ id: column.id, taskIds: column.tasks.map((task) => task.id) }));

/** Below the middle of the card it is over (cross-column drops land after it). */
function isBelow(event: DragOverEvent | DragEndEvent): boolean {
  const dragged = event.active.rect.current.translated;
  const over = event.over?.rect;
  return !!dragged && !!over && dragged.top > over.top + over.height / 2;
}

/**
 * Drag state of the board. While dragging, cards are laid out from a local `draft` (the
 * cache cannot move them); after the drop the final order is kept until the /move is
 * registered as pending, from then on the pending-move overlay holds it (features/boards).
 */
export function useBoardDrag(board: BoardDTO, setDragging: (dragging: boolean) => void) {
  const qc = useQueryClient();
  const move = useMoveTask();
  const pending = usePendingMoves(board.id);
  const [draft, setDraft] = useState<ColumnOrder[] | null>(null);
  const [settling, setSettling] = useState<{ id: string; order: ColumnOrder[] } | null>(null);
  const start = useRef<ColumnOrder[]>([]);
  const lastDrop = useRef(0);
  // Once the move shows up as pending, `board` (with the overlay) already has it.
  const settlingOrder =
    settling && !pending.some((m) => m.id === settling.id) ? settling.order : null;
  const order = draft ?? settlingOrder ?? toOrder(board);
  const orderRef = useRef(order);

  useEffect(() => {
    orderRef.current = order;
  });

  // Picking up renders nothing new (no state change): dnd-kit's keyboard sensor starts
  // listening only after a timeout, and a re-render of a 500-card board would delay it.
  // The draft appears with the first cross-column move.
  const working = () => draft ?? start.current;

  function onDragStart() {
    // A refetch already on its way must not land mid-drag with the old order.
    void qc.cancelQueries({ queryKey: queryKeys.boards.detail(board.id) });
    start.current = toOrder(board);
    orderRef.current = start.current;
    setDragging(true);
  }

  function onDragOver(event: DragOverEvent) {
    if (!event.over) return;
    const current = working();
    const activeId = String(event.active.id);
    const target = dropTargetFromOver(current, activeId, String(event.over.id), isBelow(event));
    // Cross-column moves update the draft; inside a column the sortable strategy animates.
    if (target && target.columnId !== locate(current, activeId)?.columnId) {
      setDraft(moveInColumns(current, activeId, target));
    }
  }

  function finish() {
    setDraft(null);
    setDragging(false);
    lastDrop.current = Date.now();
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const current = working();
    const target = event.over
      ? dropTargetFromOver(current, activeId, String(event.over.id), isBelow(event))
      : null;
    const final = target ? moveInColumns(current, activeId, target) : null;
    const landed = final ? locate(final, activeId) : null;
    const plan = landed ? planDrop(start.current, activeId, landed) : null;
    const column = board.columns.find((c) => c.id === landed?.columnId);
    if (final && landed && plan && column) {
      orderRef.current = final;
      setSettling({ id: activeId, order: final });
      move.mutate(
        {
          id: activeId,
          boardId: board.id,
          target: landed,
          statusCategory: column.statusCategory,
          ...plan,
        },
        { onSettled: () => setSettling((current) => (current?.id === activeId ? null : current)) },
      );
    }
    finish();
  }

  return {
    order,
    orderRef,
    handlers: { onDragStart, onDragOver, onDragEnd, onDragCancel: finish },
    justDropped: () => Date.now() - lastDrop.current < 250,
  };
}
