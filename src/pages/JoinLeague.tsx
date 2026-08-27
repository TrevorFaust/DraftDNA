import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BrandedLoader } from '@/components/BrandedLoader';
import { Button } from '@/components/ui/button';
import { SiteLogo } from '@/components/SiteLogo';
import { TeamSeatPicker } from '@/components/league/TeamSeatPicker';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { formatLeagueInviteMeta, LEAGUE_JOIN_ACTIVITIES } from '@/utils/leagueInviteCopy';
import {
  leagueClaimTeam,
  leagueInviteSeats,
  leagueJoin,
  leaguePreviewInvite,
} from '@/utils/leagueSocialApi';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import type { LeagueInvitePreview, LeagueSeat } from '@/types/leagueSocial';

export default function JoinLeague() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const { leagues, setSelectedLeague, refreshLeagues } = useLeagues();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<LeagueInvitePreview | null>(null);
  const [seats, setSeats] = useState<LeagueSeat[]>([]);
  const [pickedTeam, setPickedTeam] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  const code = inviteCode?.trim().toUpperCase() ?? '';
  const nextPath = `/join/${code}`;
  const authSignupHref = `/auth?next=${encodeURIComponent(nextPath)}&mode=signup`;
  const authSigninHref = `/auth?next=${encodeURIComponent(nextPath)}&mode=signin`;
  const inLeague = Boolean(preview?.already_member || justJoined);
  const meta = preview ? formatLeagueInviteMeta(preview) : null;
  const mySeat = useMemo(
    () => (user ? seats.find((seat) => seat.user_id === user.id) ?? null : null),
    [seats, user],
  );
  const needsSeat = inLeague && user && !mySeat;

  useEffect(() => {
    if (!code) {
      setError('Invite code is missing');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [data, seatRows] = await Promise.all([leaguePreviewInvite(code), leagueInviteSeats(code)]);
        if (cancelled) return;
        setPreview(data);
        setSeats(seatRows);
      } catch (err) {
        if (!cancelled) setError(userFacingErrorMessage(err, 'That invite link is invalid or expired.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!preview?.league_id) return;
    if (!preview.already_member && !justJoined) return;
    const league = leagues.find((l) => l.id === preview.league_id);
    if (league) setSelectedLeague(league);
  }, [justJoined, leagues, preview, setSelectedLeague]);

  const refreshSeats = async () => {
    if (!code) return;
    setSeats(await leagueInviteSeats(code));
  };

  const join = async () => {
    if (!code || pickedTeam == null) return;
    setJoining(true);
    setError(null);
    try {
      const result = await leagueJoin(code, pickedTeam);
      localStorage.setItem('selectedLeagueId', result.league_id);
      setJustJoined(true);
      setPreview((prev) => (prev ? { ...prev, already_member: true } : prev));
      await Promise.all([refreshLeagues(), refreshSeats()]);
    } catch (err) {
      setError(userFacingErrorMessage(err, "Couldn't join that league."));
    } finally {
      setJoining(false);
    }
  };

  const claim = async () => {
    if (!preview?.league_id || pickedTeam == null) return;
    setJoining(true);
    setError(null);
    try {
      await leagueClaimTeam(preview.league_id, pickedTeam);
      await refreshSeats();
    } catch (err) {
      setError(userFacingErrorMessage(err, "Couldn't claim that team."));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="font-display mb-6 text-4xl tracking-wide">Join league</h1>
        {error && !preview ? (
          <p className="text-muted-foreground">{error}</p>
        ) : !preview ? (
          <div className="flex justify-center py-10">
            <BrandedLoader />
          </div>
        ) : (
          <div className="glass-card space-y-6 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-primary shadow-glow">
                <SiteLogo size={36} className="h-9 w-9" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  {inLeague ? "You're in" : "You're invited to"}
                </p>
                <p className="font-display text-3xl tracking-wide">{preview.name}</p>
                {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
                {preview.owner_username ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invited by {preview.owner_username}
                  </p>
                ) : null}
              </div>
            </div>

            {inLeague && mySeat ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re {String(mySeat.team_number).padStart(2, '0')} {mySeat.team_name}. Lineup
                moves on Team Rankings apply to that roster. Ask the commissioner if you need to
                switch seats.
              </p>
            ) : inLeague ? (
              <p className="text-sm text-muted-foreground">
                Pick the team you run. You can only set that lineup. The commissioner can move you
                later.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You need a Draft DNA account to join. Pick your team before you join. After that you
                get everything on the site with this league, except editing league settings.
              </p>
            )}

            {(!inLeague || needsSeat) && seats.length > 0 ? (
              <TeamSeatPicker
                seats={seats}
                value={pickedTeam}
                onChange={setPickedTeam}
                disabled={joining}
                currentUserId={user?.id}
              />
            ) : null}

            {inLeague && !needsSeat ? (
              <ul className="space-y-3">
                {LEAGUE_JOIN_ACTIVITIES.map((activity) => (
                  <li key={activity.path}>
                    <Link
                      to={activity.path}
                      className="flex min-h-11 items-start gap-3 rounded-lg border border-border/50 bg-secondary/30 px-3 py-3 transition-colors hover:border-primary/40"
                    >
                      <activity.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 font-medium">
                          {activity.title}
                          <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">{activity.body}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : !inLeague ? (
              <ul className="space-y-3">
                {LEAGUE_JOIN_ACTIVITIES.map((activity) => (
                  <li key={activity.path}>
                    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-3">
                      <activity.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <div>
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">{activity.body}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {authLoading ? (
              <BrandedLoader size={28} />
            ) : inLeague && !needsSeat ? (
              <Button className="h-11 w-full" onClick={() => navigate('/dashboard')}>
                Go to home
              </Button>
            ) : inLeague && needsSeat ? (
              <Button
                className="h-11 w-full"
                disabled={joining || pickedTeam == null}
                onClick={() => void claim()}
              >
                {joining ? 'Saving…' : 'Claim this team'}
              </Button>
            ) : !user ? (
              <div className="space-y-3">
                <Button asChild className="h-11 w-full">
                  <Link to={authSignupHref}>Create an account to join</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link to={authSigninHref}>I already have an account</Link>
                </Button>
              </div>
            ) : (
              <Button
                className="h-11 w-full"
                disabled={joining || pickedTeam == null}
                onClick={() => void join()}
              >
                {joining ? 'Joining…' : 'Join league'}
              </Button>
            )}
            {error && preview ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
