import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LogOut, ListOrdered, Zap, History, User, Settings, ChevronDown, Trophy, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const { leagues, selectedLeague, setSelectedLeague } = useLeagues();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = user
    ? [
        { path: '/rankings', label: 'Rankings', icon: ListOrdered },
        { path: '/mock-draft', label: 'Mock Draft', icon: Zap },
        { path: '/history', label: 'History', icon: History },
      ]
    : [];

  const handleLeagueChange = (leagueId: string) => {
    if (leagueId === 'all') {
      setSelectedLeague(null);
    } else {
      const league = leagues.find((l) => l.id === leagueId);
      if (league) {
        setSelectedLeague(league);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-border/50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl tracking-wide text-gradient hidden sm:inline">DRAFT BOARD</span>
        </Link>

        {user && (
          <div className="flex items-center gap-1 sm:gap-2">
            {/* League Selector */}
            <Select
              value={selectedLeague?.id || 'all'}
              onValueChange={handleLeagueChange}
            >
              <SelectTrigger className="w-[140px] sm:w-[180px] bg-secondary/50 border-border/50">
                <Trophy className="w-4 h-4 mr-2 text-primary" />
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Leagues</SelectItem>
                {leagues.map((league) => (
                  <SelectItem key={league.id} value={league.id}>
                    {league.name}
                  </SelectItem>
                ))}
                <div className="border-t border-border my-1" />
                <div
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-primary"
                  onClick={() => navigate('/settings')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create League
                </div>
              </SelectContent>
            </Select>

            <div className="w-px h-6 bg-border mx-1 sm:mx-2 hidden sm:block" />

            {/* Navigation Items */}
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-2',
                    location.pathname === item.path && 'bg-secondary text-primary'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}

            <div className="w-px h-6 bg-border mx-1 sm:mx-2" />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem
                  onClick={() => navigate('/settings')}
                  className="cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {!user && (
          <Link to="/auth">
            <Button variant="default" size="sm">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};
