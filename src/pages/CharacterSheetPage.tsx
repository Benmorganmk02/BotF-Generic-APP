import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getLocalCharacter, isGuestMode, saveLocalCharacter } from '../utils/storage';
import { Character } from '../types/character';
import { saveCharacter, getCharacters } from '../lib/api/characters';
import CharacterSheet from '../components/CharacterSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Home, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function normalizeChar(char: Character): Character {
  return {
    ...char,
    weapons: char.weapons ?? [],
    bows: char.bows ?? [],
    crossbows: char.crossbows ?? [],
    berzerkActive: char.berzerkActive ?? false,
    berzerkRound: char.berzerkRound ?? 0,
  };
}

export default function CharacterSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }

    // Try local first
    const local = getLocalCharacter(id);
    if (local) {
      setCharacter(normalizeChar(local));
      setLoading(false);
      return;
    }

    // Cloud fallback for logged-in users
    const guest = isGuestMode();
    if (user && !guest) {
      getCharacters().then(result => {
        const match = result.characters.find(r => {
          try {
            const c = JSON.parse(r.data) as Character;
            return c.id === id;
          } catch { return false; }
        });
        if (match) {
          try {
            const c = { ...JSON.parse(match.data) as Character, cloudId: match.cloudId };
            saveLocalCharacter(c);
            setCharacter(normalizeChar(c));
          } catch {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
        setLoading(false);
      }).catch(() => {
        setNotFound(true);
        setLoading(false);
      });
    } else {
      setNotFound(true);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async (char: Character): Promise<{ cloudId?: string } | void> => {
    saveLocalCharacter(char);
    const guest = isGuestMode();
    if (user && !guest) {
      const result = await saveCharacter({
        cloudId: char.cloudId,
        name: char.name,
        characterType: char.characterType,
        level: char.level,
        data: JSON.stringify(char),
      });
      saveLocalCharacter({ ...char, cloudId: result.cloudId });
      toast.success('Character saved to cloud!');
      return { cloudId: result.cloudId };
    }
    toast.success('Character saved locally!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  if (notFound || !character) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Character Not Found</h2>
          <p className="text-sm text-muted-foreground">This character may have been deleted or isn't available in your local storage.</p>
          <Button onClick={() => navigate('/')}><Home className="h-4 w-4 mr-2" />Go Home</Button>
        </div>
      </div>
    );
  }

  return <CharacterSheet initialCharacter={character} onSave={handleSave} onHome={() => navigate('/')} />;
}
