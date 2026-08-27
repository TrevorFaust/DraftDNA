import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROOMS, ROOM_LABELS, ROOM_SHORT, type League, type Room, type Team } from '../types';
import { completeOrder, formatPlace } from '../scoring';

type Props = {
  league: League;
  activeRoom: Room;
  canEdit?: boolean;
  onRoomChange: (room: Room) => void;
  onReorder: (room: Room, ids: string[]) => void;
};

function roomPlayers(team: Team, room: Room): string {
  return team.players
    .filter((player) => player.room === room)
    .map((player) => (player.ir ? `${player.name} (IR)` : player.name))
    .join(', ');
}

function SortableRow({
  id,
  place,
  team,
  room,
  canDrag,
}: {
  id: string;
  place: number;
  team: Team;
  room: Room;
  canDrag: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canDrag,
  });
  const names = roomPlayers(team, room);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[2.25rem_4.5rem_1fr] items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-2 py-2"
    >
      <button
        type="button"
        className="flex h-11 w-9 items-center justify-center text-muted-foreground hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        aria-label={canDrag ? `Drag ${team.name}` : `${team.name} rank`}
        disabled={!canDrag}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="font-display text-xl leading-none text-primary tabular-nums">
        {formatPlace(place)}
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold uppercase tracking-wide">{team.name}</div>
        <div className={cn('truncate text-sm', names ? 'text-muted-foreground' : 'italic text-muted-foreground')}>
          {names || 'Empty room'}
        </div>
      </div>
    </li>
  );
}

export function RoomRanker({
  league,
  activeRoom,
  canEdit = true,
  onRoomChange,
  onReorder,
}: Props) {
  const order = completeOrder(league.ordinalRanks[activeRoom], league.teams);
  const teamById = new Map(league.teams.map((team) => [team.id, team]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(activeRoom, arrayMove(order, oldIndex, newIndex));
  }

  return (
    <section className="space-y-4" aria-label="Room ranker">
      <div>
        <h2 className="font-display text-3xl tracking-wide">{ROOM_LABELS[activeRoom]}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Drag so 1st is at the top and {formatPlace(league.teams.length)} is at the bottom. Lower room scores win the
          board.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Position rooms">
        {ROOMS.map((room) => (
          <Button
            key={room}
            type="button"
            role="tab"
            size="sm"
            variant={room === activeRoom ? 'default' : 'outline'}
            aria-selected={room === activeRoom}
            onClick={() => onRoomChange(room)}
          >
            {ROOM_SHORT[room]}
          </Button>
        ))}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-2">
            {order.map((id, index) => {
              const team = teamById.get(id);
              if (!team) return null;
              return (
                <SortableRow
                  key={id}
                  id={id}
                  place={index + 1}
                  team={team}
                  room={activeRoom}
                  canDrag={canEdit}
                />
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}
