import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import type { LucideIcon } from 'lucide-react';
import {
  LogOut,
  ListOrdered,
  History,
  User,
  Settings,
  ChevronDown,
  Trophy,
  Plus,
  Settings2,
  BarChart3,
  Home,
  Award,
  ClipboardList,
  Table2,
  Menu,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { SiteLogo } from '@/components/SiteLogo';
import { cn } from '@/lib/utils';

type NavItem = { path: string; label: string; icon: LucideIcon };

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/rankings', label: 'Rankings', icon: ListOrdered },
  { path: '/players', label: 'Player Stats', icon: Table2 },
  { path: '/statistics', label: 'Draft Stats', icon: BarChart3 },
  { path: '/mock-draft', label: 'Mock Draft', icon: ClipboardList },
  { path: '/history', label: 'History', icon: History },
  { path: '/badges', label: 'Badges', icon: Award },
  { path: '/league-settings', label: 'League Settings', icon: Settings2 },
];

function NavTabScrollArea({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateScrollFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth > clientWidth + 2;
    setShowLeftFade(hasOverflow && scrollLeft > 4);
    setShowRightFade(hasOverflow && scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollFades();
    const observer = new ResizeObserver(updateScrollFades);
    observer.observe(el);
    el.addEventListener('scroll', updateScrollFades, { passive: true });
    window.addEventListener('resize', updateScrollFades);

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScrollFades);
      window.removeEventListener('resize', updateScrollFades);
    };
  }, [updateScrollFades]);

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain scrollbar-none"
        aria-label="Site navigation tabs"
      >
        {children}
      </div>
      {showLeftFade && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-9 items-center bg-gradient-to-r from-card/95 via-card/40 to-transparent pl-0.5"
          aria-hidden
        >
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/70" />
        </div>
      )}
      {showRightFade && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-gradient-to-l from-card/95 via-card/50 to-transparent pr-0.5"
          aria-hidden
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
        </div>
      )}
    </div>
  );
}

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const { leagues, selectedLeague, setSelectedLeague } = useLeagues();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLeagueChange = (leagueId: string) => {
    if (leagueId === 'all') {
      setSelectedLeague(null);
    } else {
      const league = leagues.find((l) => l.id === leagueId);
      if (league) {
        setSelectedLeague(league);
      }
    }
    navigate('/rankings', { replace: true, state: {} });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const isActivePath = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    cn('gap-2', isActivePath(path) && 'bg-secondary text-primary');

  const menuItemClass = (path: string) =>
    cn(
      'cursor-pointer gap-2',
      isActivePath(path) && 'bg-secondary text-primary focus:bg-secondary focus:text-primary'
    );

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-border/50 px-4 py-3">
      <div className="mx-auto flex min-w-0 max-w-7xl items-center gap-2 sm:gap-3">
        <Link to="/" className="flex shrink-0 items-center justify-center gap-[1px]">
          <div className="hidden flex-col items-center sm:flex">
            <span className="font-display text-2xl leading-tight tracking-wide text-gradient">Draft</span>
            <span className="font-display text-2xl leading-tight tracking-wide text-gradient">DNA</span>
          </div>
          <SiteLogo size={56} className="h-14 w-14 shrink-0" />
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 border-border/50 bg-secondary/30 px-2.5 sm:gap-2 sm:px-3"
                aria-label="All pages"
              >
                <Menu className="h-4 w-4" />
                <span className="hidden sm:inline">Pages</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 border-border bg-card">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Go to</DropdownMenuLabel>
              {navItems.map((item) => (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={menuItemClass(item.path)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {user ? (
                <>
                  <DropdownMenuItem
                    onClick={() => navigate('/settings')}
                    className={menuItemClass('/settings')}
                  >
                    <Settings className="h-4 w-4" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => navigate('/auth')} className={menuItemClass('/auth')}>
                  Sign In
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {user && (
            <>
              <Select value={selectedLeague?.id || 'all'} onValueChange={handleLeagueChange}>
                <SelectTrigger className="w-[128px] shrink-0 border-border/50 bg-secondary/50 sm:w-[168px]">
                  <Trophy className="mr-2 h-4 w-4 text-primary" />
                  <SelectValue placeholder="All Leagues" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="all">All Leagues</SelectItem>
                  {leagues.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name}
                    </SelectItem>
                  ))}
                  <div className="my-1 border-t border-border" />
                  <div
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm text-primary outline-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => navigate('/settings')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create League
                  </div>
                </SelectContent>
              </Select>
              <div className="hidden h-6 w-px shrink-0 bg-border sm:block" />
            </>
          )}

          <NavTabScrollArea>
            <div className="flex w-max flex-nowrap items-center gap-0.5 py-0.5 sm:gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path} className="shrink-0">
                  <Button variant="ghost" size="sm" className={navLinkClass(item.path)}>
                    <item.icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </NavTabScrollArea>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {user ? (
              <>
                <div className="hidden h-6 w-px bg-border sm:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="shrink-0 gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="hidden max-w-[100px] truncate sm:inline">
                        {user.email?.split('@')[0]}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 border-border bg-card">
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <div className="hidden h-6 w-px bg-border sm:block" />
                <Link to="/auth" className="shrink-0">
                  <Button variant="default" size="sm">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
