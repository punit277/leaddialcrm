import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Menu, Phone } from 'lucide-react';

export function AppLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {isMobile && (
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <span className="font-bold">LeadDial</span>
          </div>
        </header>
      )}

      <main className={isMobile ? '' : 'pl-64'}>
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
