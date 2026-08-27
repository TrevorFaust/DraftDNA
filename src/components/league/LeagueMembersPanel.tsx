import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Link2, LogOut, MessageSquare, RefreshCw, Share2, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrandedLoader } from '@/components/BrandedLoader';
import type { LeagueMember, LeagueSeat } from '@/types/leagueSocial';
import {
  leagueAddMemberByUsername,
  leagueGetOrCreateInvite,
  leagueInviteUrl,
  leagueLeave,
  leagueListMembers,
  leagueListSeats,
  leagueRemoveMember,
  leagueRotateInvite,
  leagueSetMemberTeam,
} from '@/utils/leagueSocialApi';
import { LEAGUE_JOIN_ACTIVITIES, leagueInviteMessage } from '@/utils/leagueInviteCopy';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  leagueId: string;
  leagueName: string;
  isOwner: boolean;
  onLeftLeague?: () => void;
};

export function LeagueMembersPanel({ leagueId, leagueName, isOwner, onLeftLeague }: Props) {
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [seats, setSeats] = useState<LeagueSeat[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [addTeam, setAddTeam] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const inviteUrl = inviteCode ? leagueInviteUrl(inviteCode) : '';
  const defaultMessage = useMemo(
    () => (inviteUrl ? leagueInviteMessage(leagueName, inviteUrl) : ''),
    [inviteUrl, leagueName],
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage(defaultMessage);
  }, [defaultMessage]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, seatRows] = await Promise.all([
        leagueListMembers(leagueId),
        leagueListSeats(leagueId),
      ]);
      setMembers(list);
      setSeats(seatRows);
      if (isOwner) {
        const code = await leagueGetOrCreateInvite(leagueId);
        setInviteCode(code);
      } else {
        setInviteCode(null);
      }
    } catch (error) {
      toast.error(userFacingErrorMessage(error, "Couldn't load members."));
    } finally {
      setLoading(false);
    }
  }, [isOwner, leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const code = await leagueRotateInvite(leagueId);
      setInviteCode(code);
      toast.success('Old invite link no longer works');
    } catch (error) {
      toast.error(userFacingErrorMessage(error, "Couldn't rotate the invite link."));
    } finally {
      setBusy(false);
    }
  };

  const shareInvite = async () => {
    const text = message.trim() || defaultMessage;
    if (!text || !inviteUrl) return;
    const payload: ShareData = {
      title: `Join ${leagueName} on Draft DNA`,
      text,
      url: inviteUrl,
    };
    if (!navigator.share) {
      await copyText('Invite message', text);
      return;
    }
    try {
      if (navigator.canShare && !navigator.canShare(payload)) {
        await copyText('Invite message', text);
        return;
      }
      await navigator.share(payload);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.error("Couldn't open the share sheet.");
    }
  };

  const textFriends = async () => {
    const text = message.trim() || defaultMessage;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* still try sms: */
    }
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
    toast.success('Message copied. Opening your texting app if this device has one.');
  };

  const addByUsername = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await leagueAddMemberByUsername(
        leagueId,
        trimmed,
        addTeam === 'none' ? null : Number(addTeam),
      );
      setUsername('');
      setAddTeam('none');
      toast.success(`Added ${trimmed}`);
      await load();
    } catch (error) {
      toast.error(userFacingErrorMessage(error, "Couldn't add that username."));
    } finally {
      setBusy(false);
    }
  };

  const assignMemberTeam = async (member: LeagueMember, teamNumber: number | null) => {
    setBusy(true);
    try {
      await leagueSetMemberTeam(leagueId, member.user_id, teamNumber);
      toast.success(
        teamNumber == null
          ? `${member.username} has no team now`
          : `Moved ${member.username}`,
      );
      await load();
    } catch (error) {
      toast.error(userFacingErrorMessage(error, "Couldn't move that person."));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: LeagueMember) => {
    setBusy(true);
    try {
      await leagueRemoveMember(leagueId, member.user_id);
      toast.success(`Removed ${member.username}`);
      await load();
    } catch (error) {
      toast.error(userFacingErrorMessage(error, "Couldn't remove that member."));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await leagueLeave(leagueId);
      toast.success('You left the league');
      onLeftLeague?.();
    } catch (error) {
      toast.error(userFacingErrorMessage(error, "Couldn't leave this league."));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <BrandedLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Invite friends
            </CardTitle>
            <CardDescription>
              Send the link or the message below. Friends create a Draft DNA account if they
              don&apos;t have one, pick a team, then join this league.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="league-invite-link">Invite link</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="league-invite-link"
                  readOnly
                  value={inviteUrl}
                  aria-label="League invite link"
                  className="h-11 font-mono text-sm"
                />
                <Button
                  type="button"
                  onClick={() => void copyText('Invite link', inviteUrl)}
                  disabled={!inviteCode || busy}
                  className="h-11 gap-2 sm:shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  Copy link
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="league-invite-message">Message to send</Label>
              <Textarea
                id="league-invite-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={7}
                className="min-h-[10.5rem] text-sm leading-relaxed"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void copyText('Invite message', message.trim() || defaultMessage)}
                  disabled={!inviteCode || busy}
                  className="h-11 gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy message
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void textFriends()}
                  disabled={!inviteCode || busy}
                  className="h-11 gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Text friends
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void shareInvite()}
                  disabled={!inviteCode || busy}
                  className="h-11 gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void rotate()}
                  disabled={busy}
                  className="h-11 gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  New link
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                New link retires the old one. Anyone who already joined stays in the league.
              </p>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {LEAGUE_JOIN_ACTIVITIES.map((activity) => (
                <li key={activity.path}>
                  <span className="font-medium text-foreground">{activity.title}.</span> {activity.body}
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <Label htmlFor="add-member-username">Add by username</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="add-member-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="their_username"
                  autoComplete="off"
                  className="h-11"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addByUsername();
                    }
                  }}
                />
                <Select value={addTeam} onValueChange={setAddTeam} disabled={busy}>
                  <SelectTrigger className="h-11 sm:w-[12rem]" aria-label="Team for new member">
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team yet</SelectItem>
                    {seats
                      .filter((seat) => !seat.user_id)
                      .map((seat) => (
                        <SelectItem key={seat.team_number} value={String(seat.team_number)}>
                          {String(seat.team_number).padStart(2, '0')} {seat.team_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => void addByUsername()}
                  disabled={busy || !username.trim()}
                  className="h-11 gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </CardTitle>
          <CardDescription>
            Each person claims one team and sets that lineup. You can move someone to another seat
            or remove them if they picked the wrong team. Moving onto a taken seat swaps those two
            people.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((member) => {
            const seat = seats.find((row) => row.team_number === member.team_number);
            return (
            <div
              key={member.user_id}
              className="flex flex-col gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{member.username}</p>
                <p className="text-xs text-muted-foreground">
                  {member.role === 'owner' ? 'Owner' : 'Member'}
                  {seat
                    ? ` · ${String(seat.team_number).padStart(2, '0')} ${seat.team_name}`
                    : ' · No team'}
                </p>
              </div>
              {isOwner ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={member.team_number == null ? 'none' : String(member.team_number)}
                    onValueChange={(value) =>
                      void assignMemberTeam(member, value === 'none' ? null : Number(value))
                    }
                    disabled={busy}
                  >
                    <SelectTrigger
                      className="h-11 w-full sm:w-[12.5rem]"
                      aria-label={`Team for ${member.username}`}
                    >
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No team</SelectItem>
                      {seats.map((row) => (
                        <SelectItem key={row.team_number} value={String(row.team_number)}>
                          {String(row.team_number).padStart(2, '0')} {row.team_name}
                          {row.user_id && row.user_id !== member.user_id && row.username
                            ? ` · ${row.username}`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {member.role !== 'owner' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${member.username}`}
                      disabled={busy}
                      onClick={() => void removeMember(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            );
          })}
          {!isOwner && (
            <Button type="button" variant="outline" className="mt-3 h-11 gap-2" disabled={busy} onClick={() => void leave()}>
              <LogOut className="h-4 w-4" />
              Leave league
            </Button>
          )}
          <p className="pt-2 text-sm text-muted-foreground">
            <Link to="/rankings" className="text-primary underline-offset-2 hover:underline">
              Rankings
            </Link>
            {' · '}
            <Link to="/mock-draft" className="text-primary underline-offset-2 hover:underline">
              Mock Draft
            </Link>
            {' · '}
            <Link to="/league-ranker" className="text-primary underline-offset-2 hover:underline">
              Team Rankings
            </Link>
            {' · '}
            <Link to="/pickem" className="text-primary underline-offset-2 hover:underline">
              Weekly Pick&apos;em
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
