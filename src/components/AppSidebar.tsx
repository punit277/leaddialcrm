import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Phone,
  Upload,
  FileText,
  UserCog,
  Download,
  LogOut,
  Headphones,
  ArrowLeftRight,
  Trash2,
  Megaphone,
  CalendarClock,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

const adminLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Lead Browser' },
  { to: '/import', icon: Upload, label: 'Import Manager' },
  { to: '/call-logs', icon: FileText, label: 'Call Logs' },
  { to: '/agents', icon: Headphones, label: 'Agent Monitor' },
  { to: '/users', icon: UserCog, label: 'User Management' },
  { to: '/export', icon: Download, label: 'Export Center' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/follow-ups', icon: CalendarClock, label: 'Follow-Up Diary' },
  { to: '/delete-leads', icon: Trash2, label: 'Delete Leads' },
  { to: '/settings/fields', icon: Settings, label: 'Field Settings' },
];

const agentLinks = [
  { to: '/agent', icon: Phone, label: 'Call Queue' },
  { to: '/agent/follow-ups', icon: CalendarClock, label: 'Follow-Up Diary' },
  { to: '/agent/history', icon: FileText, label: 'My Call History' },
];

interface AppSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role, roles, profile, signOut, switchRole } = useAuth();
  const navigate = useNavigate();
  const links = role === 'admin' ? adminLinks : agentLinks;

  return (
    <>
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <Phone className="h-6 w-6 text-sidebar-primary" />
        <span className="text-lg font-bold tracking-tight">LeadDial</span>
        <span className="ml-1 rounded bg-sidebar-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sidebar-primary">
          CRM
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
          <p className="text-xs text-sidebar-foreground/50 capitalize">{role}</p>
        </div>
        {roles.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newRole = role === 'admin' ? 'agent' : 'admin';
              switchRole(newRole);
              navigate(newRole === 'admin' ? '/dashboard' : '/agent');
              onNavigate?.();
            }}
            className="mb-1 w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent min-h-[44px]"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch to {role === 'admin' ? 'Agent' : 'Admin'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { signOut(); onNavigate?.(); }}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent min-h-[44px]"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );
}

export function AppSidebar({ open, onOpenChange }: AppSidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground flex flex-col">
          <SidebarContent onNavigate={() => onOpenChange?.(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
      <SidebarContent />
    </aside>
  );
}
