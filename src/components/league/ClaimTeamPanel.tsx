import { Button } from '@/components/ui/button';
import { TeamSeatPicker } from '@/components/league/TeamSeatPicker';
import { useAuth } from '@/hooks/useAuth';
import type { LeagueSeat } from '@/types/leagueSocial';

type Props = {
  leagueName: string;
  seats: LeagueSeat[];
  pickedTeam: number | null;
  saving?: boolean;
  error?: string | null;
  onPick: (teamNumber: number) => void;
  onClaim: () => void;
};

export function ClaimTeamPanel({
  leagueName,
  seats,
  pickedTeam,
  saving,
  error,
  onPick,
  onClaim,
}: Props) {
  const { user } = useAuth();

  return (
    <section className="glass-card mx-auto max-w-lg space-y-5 p-6" aria-label="Select a team">
      <div>
        <h2 className="font-display text-3xl tracking-wide">Select a team</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick the team you run in {leagueName}. You can use the rest of the site after that.
        </p>
      </div>
      <TeamSeatPicker
        seats={seats}
        value={pickedTeam}
        onChange={onPick}
        disabled={saving}
        currentUserId={user?.id}
      />
      <Button className="h-11 w-full" disabled={saving || pickedTeam == null} onClick={() => void onClaim()}>
        {saving ? 'Saving…' : 'Claim this team'}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
