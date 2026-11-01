"use client";

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState } from "@/components/common/error-state";
import { ListRowsSkeleton } from "@/components/common/list-skeleton";
import { useBoard, usePendingMoves, withPendingMoves } from "@/features/boards/hooks";
import type { BoardDTO } from "@/features/boards/schemas";
import { BoardColumn } from "./board-column";
import { arrange, KEYBOARD_CODES, MEASURING } from "./board-layout";
import { useBoardAnnouncements } from "./use-board-announcements";
import { useBoardDrag } from "./use-board-drag";
import { useColumnActions } from "./use-column-actions";

type Props = {
  boardId: string;
  projectId: string;
  readOnly: boolean;
  onOpen: (id: string) => void;
};

/** docs/06 section 4.4. TODO(MVP-3): sprint scope picker (BR-47); Scrum shows every task. */
export function KanbanBoard({ boardId, projectId, readOnly, onOpen }: Props) {
  const dragging = useRef(false);
  const setDragging = useCallback((value: boolean) => {
    dragging.current = value;
  }, []);
  const pending = usePendingMoves(boardId);
  const pendingCount = useRef(0);
  useEffect(() => {
    pendingCount.current = pending.length;
  }, [pending.length]);
  // No window-focus refetch while a card is in the air or its /move is in flight. Read from
  // refs at focus time, so picking a card up does not re-render the board.
  const query = useBoard(boardId, {
    refetchOnWindowFocus: () => !dragging.current && pendingCount.current === 0,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    }),
  );

  // Stable object while nothing changes, so freezing it at pick-up costs no re-render.
  const live = useMemo(
    () => (query.data ? withPendingMoves(query.data, pending) : undefined),
    [query.data, pending],
  );

  if (query.isPending) return <ListRowsSkeleton rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!live) return null;
  return (
    <Board
      board={live}
      projectId={projectId}
      readOnly={readOnly}
      onOpen={onOpen}
      sensors={sensors}
      setDragging={setDragging}
    />
  );
}

type BoardProps = Omit<Props, "boardId"> & {
  board: BoardDTO;
  sensors: ReturnType<typeof useSensors>;
  setDragging: (dragging: boolean) => void;
};

function Board({
  board: liveBoard,
  projectId,
  readOnly,
  onOpen,
  sensors,
  setDragging,
}: BoardProps) {
  // While a card is in the air the board is frozen as it was at pick-up: a refetch landing
  // mid-drag (e.g. after a task was just added) re-rendered the cards and lost keyboard
  // moves. Newer data shows after the drop; moves still in flight are re-applied on top.
  const [frozen, setFrozen] = useState<BoardDTO | null>(null);
  const board = frozen ?? liveBoard;
  const drag = useBoardDrag(board, (dragging) => {
    setDragging(dragging);
    setFrozen(dragging ? liveBoard : null);
  });
  const accessibility = useBoardAnnouncements(board, drag.orderRef);
  const actionsFor = useColumnActions(board);
  const shown = useMemo(() => arrange(board, drag.order), [board, drag.order]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={MEASURING}
      accessibility={accessibility}
      {...drag.handlers}
    >
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        {shown.columns.map((column, index) => (
          <BoardColumn
            key={column.id}
            column={column}
            board={shown}
            projectId={projectId}
            index={index}
            readOnly={readOnly}
            actions={actionsFor(column.id)}
            onOpen={onOpen}
            justDropped={drag.justDropped}
          />
        ))}
      </div>
    </DndContext>
  );
}
