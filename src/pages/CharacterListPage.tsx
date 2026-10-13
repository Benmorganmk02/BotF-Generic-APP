import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isGuestMode, getLocalCharacters, saveLocalCharacter, deleteLocalCharacter } from '../utils/storage';
import { Character } from '../types/character';
import { getCharacters, saveCharacter, deleteCharacter } from '../lib/api/characters';
import CreateCharacterDialog from '../components/CreateCharacterDialog';
import FriendsTab from '../components/social/FriendsTab';
import CampaignsTab from '../components/social/CampaignsTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Sword, Trash2, LogIn, LogOut, Users, Swords } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-primary/20 text-primary border-primary/40',
  gm: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
};
const TYPE_LABELS: Record<string, string> = { normal: 'Normal', gm: 'GM/NPC' };

export default function CharacterListPage() {
  const { user, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const loadCharacters = async () => {
    setLoading(true);
    const guest = isGuestMode();
    if (user && !guest) {
      try {
        const result = await getCharacters();
        const chars = result.characters.map(r => {
          try { const c = JSON.parse(r.data) as Character; return { ...c, cloudId: r.cloudId }; }
          catch { return null; }
        }).filter(Boolean) as Character[];
        chars.forEach(saveLocalCharacter);
        setCharacters(chars);
      } catch { setCharacters(getLocalCharacters()); }
    } else {
      setCharacters(getLocalCharacters());
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) loadCharacters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const handleCreate = async (char: Character) => {
    saveLocalCharacter(char);
    if (user && !isGuestMode()) {
      try {
        const result = await saveCharacter({ name: char.name, characterType: char.characterType, level: char.level, data: JSON.stringify(char) });
        saveLocalCharacter({ ...char, cloudId: result.cloudId });
      } catch { toast.error('Failed to sync to cloud. Saved locally.'); }
    }
    await loadCharacters();
    navigate(`/sheet/${char.id}`);
  };

  const handleDelete = async (char: Character) => {
    deleteLocalCharacter(char.id);
    if (user && !isGuestMode() && char.cloudId) {
      try { await deleteCharacter({ cloudId: char.cloudId }); }
      catch { toast.error('Failed to delete from cloud.'); }
    }
    setCharacters(prev => prev.filter(c => c.id !== char.id));
    toast.success('Character deleted.');
    setDeleteTarget(null);
  };

  const guest = isGuestMode();
  const isLoggedIn = !!user && !guest;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sword className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Blades of the Valorous</h1>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-muted-foreground hidden sm:block">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut className="h-4 w-4 mr-1" />Log out
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              <LogIn className="h-4 w-4 mr-1" />Sign In
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {guest && (
          <p className="text-xs text-muted-foreground mb-4 text-center bg-muted/50 rounded-lg py-2 px-3">
            Guest mode — characters saved locally only.{' '}
            <button className="text-primary underline" onClick={() => navigate('/login')}>Sign in</button> to sync and access Friends & Campaigns.
          </p>
        )}

        <Tabs defaultValue="characters">
          <TabsList className={`mb-4 ${!isLoggedIn ? 'opacity-60' : ''}`}>
            <TabsTrigger value="characters" className="flex items-center gap-1.5">
              <Sword className="h-3.5 w-3.5" />Characters
            </TabsTrigger>
            <TabsTrigger value="friends" disabled={!isLoggedIn} className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />Friends
            </TabsTrigger>
            <TabsTrigger value="campaigns" disabled={!isLoggedIn} className="flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5" />Campaigns
            </TabsTrigger>
          </TabsList>

          {/* Characters Tab */}
          <TabsContent value="characters" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Your Characters</h2>
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />New Character
              </Button>
            </div>

            {loading || authLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ) : characters.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <Sword className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">No characters yet.</p>
                <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Create your first character</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {characters.map(char => (
                  <div key={char.id}
                    className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors cursor-pointer group relative"
                    onClick={() => navigate(`/sheet/${char.id}`)}>
                    <div className="absolute top-2 right-2">
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); setDeleteTarget(char); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-foreground truncate pr-8">{char.name || 'Unnamed'}</h3>
                      {char.player && <p className="text-xs text-muted-foreground">Player: {char.player}</p>}
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs border ${TYPE_COLORS[char.characterType] ?? ''}`}>
                          {TYPE_LABELS[char.characterType] ?? char.characterType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Level {char.level}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends">
            {isLoggedIn ? <FriendsTab /> : null}
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            {isLoggedIn ? <CampaignsTab /> : null}
          </TabsContent>
        </Tabs>
      </div>

      <CreateCharacterDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
