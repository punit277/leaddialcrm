import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  full_name: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);

  const fetchUsers = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    if (!roles?.length) return;
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, is_active, created_at').in('id', roles.map(r => r.user_id));
    const roleMap = Object.fromEntries(roles.map(r => [r.user_id, r.role]));
    setUsers((profiles ?? []).map(p => ({ ...p, role: roleMap[p.id] ?? 'agent' })));
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleActive = async (userId: string, current: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', userId);
    if (error) toast.error('Failed to update');
    else { toast.success('User updated'); fetchUsers(); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">{users.length} users</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name ?? '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u.id, u.is_active)} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
