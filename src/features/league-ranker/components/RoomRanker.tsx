import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROOMS, ROOM_LABELS, ROOM_SHORT, type League, type Room, type Team } from '../types';
import { completeOrder, formatPlace } from '../scoring';

type Props = {
  league: League;
  activeRoom: Room;
  canEdit?: boolean;
  contributorCount?: number;
  onRoomChange: (room: Room) => void;
  onReorder: (room: Room, ids: string[]) => void;
};

type RoomPlayer = {
  id: string;
  label: string;
};

function roomPlayers(team: Team, room: Room): RoomPlayer[] {
  return team.players
    .filter((player) => player.room === room)
    .map((player) => ({
      id: player.id,
      label: player.ir ? `${player.name} (IR)` : player.name,
    }));
}

function RankRowBody({ team, room, place }: { team: Team; room: Room; place: number }) {
  const players = roomPlayers(team, room);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-display text-xl leading-none text-primary tabular-nums">
          {formatPlace(place)}
        </span>
        <span className="font-semibold uppercase tracking-wide break-words">{team.name}</span>
      </div>
      {players.length ? (
        <p className="mt-1 text-base leading-snug text-muted-foreground md:text-sm">
          {players.map((player, index) => (
            <span key={player.id} className="break-words">
              {player.label}
              {index < players.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-1 text-base italic leading-snug text-muted-foreground md:text-sm">Empty room</p>
      )}
    </div>
  );
}

function SortableRow({
  id,
  place,
  team,
  room,
  canEdit,
  isFirst,
  isLast,
  onMove,
}: {
  id: string;
  place: number;
  team: Team;
  room: Room;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !canEdit,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid items-start gap-2 rounded-md border border-border/60 bg-secondary/30 py-2 pl-2 pr-1',
        canEdit ? 'grid-cols-[minmax(0,1fr)_2.75rem] md:grid-cols-[2.75rem_minmax(0,1fr)]' : 'grid-cols-1',
      )}
    >
      {canEdit ? (
        <div
          ref={setActivatorNodeRef}
          className="hidden h-11 w-11 cursor-grab items-center justify-center rounded-md text-muted-foreground select-none active:cursor-grabbing active:bg-secondary md:flex"
          aria-label={`Drag ${team.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 pointer-events-none" />
        </div>
      ) : null}
      <RankRowBody team={team} room={room} place={place} />
      {canEdit ? (
        <div className="flex flex-col gap-1 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            disabled={isFirst}
            aria-label={`Move ${team.name} up`}
            onClick={() => onMove(-1)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            disabled={isLast}
            aria-label={`Move ${team.name} down`}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function RoomRanker({
  league,
  activeRoom,
  canEdit = true,
  contributorCount,
  onRoomChange,
  onReorder,
}: Props) {
  const order = completeOrder(league.ordinalRanks[activeRoom], league.teams);
  const teamById = new Map(league.teams.map((team) => [team.id, team]));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(activeRoom, arrayMove(order, oldIndex, newIndex));
  }

  function moveTeam(id: string, delta: -1 | 1) {
    if (!canEdit) return;
    const oldIndex = order.indexOf(id);
    if (oldIndex < 0) return;
    const newIndex = Math.min(order.length - 1, Math.max(0, oldIndex + delta));
    if (newIndex === oldIndex) return;
    onReorder(activeRoom, arrayMove(order, oldIndex, newIndex));
  }

  const overlayTeam = activeId ? teamById.get(activeId) : undefined;
  const overlayPlace = activeId ? order.indexOf(activeId) + 1 : 0;

  return (
    <section className="space-y-4" aria-label="Room ranker">
      <div>
        <h2 className="font-display text-3xl tracking-wide">{ROOM_LABELS[activeRoom]}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground md:hidden">
          {canEdit
            ? `Tap the arrows to move a team. 1st stays at the top, ${formatPlace(league.teams.length)} at the bottom.`
            : `League crowd order for this room. ${contributorCount ?? 0} members ranked; your self-rank is excluded from each team's crowd score.`}
        </p>
        <p className="mt-1 hidden max-w-prose text-sm text-muted-foreground md:block">
          {canEdit
            ? `Drag the handle so 1st is at the top and ${formatPlace(league.teams.length)} is at the bottom. Lower room scores win the board.`
            : `League crowd order for this room. ${contributorCount ?? 0} members ranked; your self-rank is excluded from each team's crowd score.`}
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
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
                  canEdit={canEdit}
                  isFirst={index === 0}
                  isLast={index === order.length - 1}
                  onMove={(delta) => moveTeam(id, delta)}
                />
              );
            })}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {overlayTeam ? (
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2 rounded-md border border-primary bg-card px-2 py-2 shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center text-primary">
                <GripVertical className="h-5 w-5" />
              </div>
              <RankRowBody team={overlayTeam} room={activeRoom} place={overlayPlace} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
