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
  Newspaper,
  Layers,
  CalendarDays,
  Medal,
  ListChecks,
  Target,
} from 'lucide-react';
import { SiteLogo } from '@/components/SiteLogo';
import { NewsTeamPicker } from '@/components/news/NewsTeamPicker';
import { cn } from '@/lib/utils';

type NavItem = { path: string; label: string; icon: LucideIcon };

const homeItem: NavItem = { path: '/dashboard', label: 'Home', icon: Home };
const pickSixItem: NavItem = { path: '/prediction-challenge', label: 'Pick Six', icon: Target };
const leagueSettingsItem: NavItem = {
  path: '/league-settings',
  label: 'League Settings',
  icon: Settings2,
};
const newsItem: NavItem = { path: '/news', label: 'News', icon: Newspaper };

const preSeasonItems: NavItem[] = [
  { path: '/mock-draft', label: 'Mock Draft', icon: ClipboardList },
  { path: '/rankings', label: 'Rankings', icon: ListOrdered },
  { path: '/players', label: 'Player Stats', icon: Table2 },
  { path: '/statistics', label: 'Draft Stats', icon: BarChart3 },
  { path: '/history', label: 'History', icon: History },
  { path: '/badges', label: 'Badges', icon: Award },
];

const inSeasonItems: NavItem[] = [
  { path: '/pickem', label: "Pick'em", icon: ListChecks },
  { path: '/league-ranker', label: 'Team Rankings', icon: Medal },
];

function pathMatches(pathname: string, path: string) {
  if (path === '/news') return pathname.startsWith('/news');
  return pathname === path;
}

function NavTabScrollArea({
  children,
  onOverflowChange,
}: {
  children: ReactNode;
  onOverflowChange?: (hasOverflow: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 2;
    setHasOverflow(overflow);
    onOverflowChange?.(overflow);
    setCanScrollLeft(overflow && scrollLeft > 4);
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 4);
  }, [onOverflowChange]);

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const amount = Math.max(120, el.clientWidth * 0.55);
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const inner = el.firstElementChild;

    updateScrollFades();
    const observer = new ResizeObserver(updateScrollFades);
    observer.observe(el);
    if (inner) observer.observe(inner);
    el.addEventListener('scroll', updateScrollFades, { passive: true });
    window.addEventListener('resize', updateScrollFades);

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScrollFades);
      window.removeEventListener('resize', updateScrollFades);
    };
  }, [updateScrollFades]);

  return (
    <div className="relative min-w-0 w-full">
      <div
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain scrollbar-none"
        aria-label="Site navigation tabs"
      >
        <div className={cn('w-max', !hasOverflow && 'mx-auto')}>{children}</div>
      </div>
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollTabs('left')}
          className="absolute inset-y-0 left-0 z-10 flex w-9 items-center bg-gradient-to-r from-card/95 via-card/40 to-transparent pl-0.5 text-muted-foreground/70 transition-colors hover:text-foreground"
          aria-label="Scroll navigation left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollTabs('right')}
          className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-gradient-to-l from-card/95 via-card/50 to-transparent pr-0.5 text-muted-foreground/70 transition-colors hover:text-foreground"
          aria-label="Scroll navigation right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const TAB_LABELS_MEDIA_QUERY = '(min-width: 1024px)';

function useTabLabelsVisible() {
  const [tabLabelsVisible, setTabLabelsVisible] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(TAB_LABELS_MEDIA_QUERY).matches : true
  );

  useEffect(() => {
    const mql = window.matchMedia(TAB_LABELS_MEDIA_QUERY);
    const onChange = () => setTabLabelsVisible(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return tabLabelsVisible;
}

function NavLinkButton({
  item,
  className,
  current,
}: {
  item: NavItem;
  className: string;
  current?: boolean;
}) {
  return (
    <Link to={item.path} className="shrink-0">
      <Button variant="ghost" size="sm" className={className} aria-current={current ? 'page' : undefined}>
        <item.icon className="h-4 w-4" />
        <span className="hidden lg:inline">{item.label}</span>
      </Button>
    </Link>
  );
}

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const { leagues, selectedLeague, setSelectedLeague } = useLeagues();
  const location = useLocation();
  const navigate = useNavigate();
  const tabLabelsVisible = useTabLabelsVisible();
  const [tabsOverflow, setTabsOverflow] = useState(false);
  const [preSeasonMenuOpen, setPreSeasonMenuOpen] = useState(false);
  const [inSeasonMenuOpen, setInSeasonMenuOpen] = useState(false);
  const showPagesMenu = !tabLabelsVisible && tabsOverflow;

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
    navigate('/auth', { replace: true });
  };

  const isActivePath = (path: string) => pathMatches(location.pathname, path);
  const preSeasonActive = preSeasonItems.some((item) => isActivePath(item.path));
  const inSeasonActive = inSeasonItems.some((item) => isActivePath(item.path));

  const navLinkClass = (path: string) =>
    cn('gap-2', isActivePath(path) && 'bg-secondary text-primary');

  const groupTriggerClass = (active: boolean) =>
    cn('gap-2', active && 'bg-secondary text-primary');

  const menuItemClass = (path: string) =>
    cn(
      'cursor-pointer gap-2',
      isActivePath(path) && 'bg-secondary text-primary focus:bg-secondary focus:text-primary'
    );

  const renderMenuItem = (item: NavItem, className?: string) => (
    <DropdownMenuItem
      key={item.path}
      onClick={() => navigate(item.path)}
      className={cn(menuItemClass(item.path), className)}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </DropdownMenuItem>
  );

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-border/50 py-3 pl-5 pr-4 sm:pl-6 sm:pr-5">
      <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link to="/" className="flex shrink-0 items-center justify-center gap-[1px]">
            <div className="hidden flex-col items-center sm:flex">
              <span className="font-display text-2xl leading-tight tracking-wide text-gradient">Draft</span>
              <span className="font-display text-2xl leading-tight tracking-wide text-gradient">DNA</span>
            </div>
            <SiteLogo size={56} className="h-14 w-14 shrink-0" />
          </Link>

          {showPagesMenu && (
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
                {renderMenuItem(homeItem)}
                {renderMenuItem(pickSixItem)}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Pre Season</DropdownMenuLabel>
                {preSeasonItems.map((item) => renderMenuItem(item, 'pl-4'))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">In Season</DropdownMenuLabel>
                {inSeasonItems.map((item) => renderMenuItem(item, 'pl-4'))}
                <DropdownMenuSeparator />
                {renderMenuItem(newsItem)}
                {renderMenuItem(leagueSettingsItem)}
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
          )}
        </div>

        <NavTabScrollArea onOverflowChange={setTabsOverflow}>
          <div className="flex w-max flex-nowrap items-center gap-0.5 py-0.5 sm:gap-1">
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
            <NavLinkButton item={homeItem} className={navLinkClass(homeItem.path)} current={isActivePath(homeItem.path)} />
            <NavLinkButton item={pickSixItem} className={navLinkClass(pickSixItem.path)} current={isActivePath(pickSixItem.path)} />

            <DropdownMenu open={preSeasonMenuOpen} onOpenChange={setPreSeasonMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={groupTriggerClass(preSeasonActive)}
                  aria-current={preSeasonActive ? 'true' : undefined}
                >
                  <Layers className="h-4 w-4" />
                  <span className="hidden lg:inline">Pre Season</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 border-border bg-card">
                {preSeasonItems.map((item) => (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => {
                      setPreSeasonMenuOpen(false);
                      navigate(item.path);
                    }}
                    className={menuItemClass(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={inSeasonMenuOpen} onOpenChange={setInSeasonMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={groupTriggerClass(inSeasonActive)}
                  aria-current={inSeasonActive ? 'true' : undefined}
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden lg:inline">In Season</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 border-border bg-card">
                {inSeasonItems.map((item) => (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => {
                      setInSeasonMenuOpen(false);
                      navigate(item.path);
                    }}
                    className={menuItemClass(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <NewsTeamPicker />
            <NavLinkButton
              item={leagueSettingsItem}
              className={navLinkClass(leagueSettingsItem.path)}
              current={isActivePath(leagueSettingsItem.path)}
            />
          </div>
        </NavTabScrollArea>

        <div className="flex shrink-0 items-center justify-self-end gap-1 sm:gap-2">
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
    </nav>
  );
};
