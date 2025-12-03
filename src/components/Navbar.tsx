import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, ListOrdered, Zap, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/rankings', label: 'Rankings', icon: ListOrdered },
    { path: '/mock-draft', label: 'Mock Draft', icon: Zap },
    { path: '/history', label: 'History', icon: History },
  ];

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-border/50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl tracking-wide text-gradient">DRAFT BOARD</span>
        </Link>

        {user && (
          <div className="flex items-center gap-1">
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
            
            <div className="w-px h-6 bg-border mx-2" />
            
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline max-w-[100px] truncate">
                {user.email?.split('@')[0]}
              </span>
            </Button>
            
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
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
