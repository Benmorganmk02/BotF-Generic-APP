import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getLocalCharacter, isGuestMode, saveLocalCharacter } from '../utils/storage';
import { Character } from '../types/character';
import { saveCharacter, getCharacters, getCharacterRow } from '../lib/api/characters';
import { syncCharacterToCampaigns, getLinkedCampaignCopies } from '../lib/api/social';
import type { SyncTarget } from '../components/sheet/SaveTargetsMenu';
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
    firearms: char.firearms ?? [],
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
  // Bumped when newer data is pulled from the cloud, so the sheet remounts with it
  const [refreshKey, setRefreshKey] = useState(0);
  // The campaign copies a save can also update
  const [targets, setTargets] = useState<SyncTarget[]>([]);
  const cloudId = character?.cloudId;
  useEffect(() => {
    if (!cloudId || !user || isGuestMode()) { setTargets([]); return; }
    let cancelled = false;
    getLinkedCampaignCopies({ originalId: cloudId })
      .then(copies => { if (!cancelled) setTargets(copies.map(c => ({ id: c.id, kind: 'campaign' as const, label: `Campaign: ${c.campaignName}` }))); })
      .catch(() => { if (!cancelled) setTargets([]); });
    return () => { cancelled = true; };
  }, [cloudId, user]);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }

    // Try local first
    const local = getLocalCharacter(id);
    if (local) {
      // Signed in with a cloud copy: if the cloud row changed after we last synced (for example it was edited
      // through a campaign copy), pull that in so this sheet and the campaign copy stay the same.
      if (user && !isGuestMode() && local.cloudId) {
        let cancelled = false;
        getCharacterRow(local.cloudId).then(row => {
          if (cancelled) return;
          if (row && local.cloudSyncedAt && row.updatedAt > local.cloudSyncedAt) {
            try {
              const fresh = { ...JSON.parse(row.data) as Character, cloudId: row.cloudId, cloudSyncedAt: row.updatedAt };
              saveLocalCharacter(fresh);
              setCharacter(normalizeChar(fresh));
              setRefreshKey(k => k + 1);
              toast.info('Updated with the latest from your campaign copy.');
              return;
            } catch { /* fall through to the local copy */ }
          }
          // First time we see this copy: remember the cloud version it matches
          const known = row && !local.cloudSyncedAt ? { ...local, cloudSyncedAt: row.updatedAt } : local;
          if (known !== local) saveLocalCharacter(known);
          setCharacter(normalizeChar(known));
        }).catch(() => { if (!cancelled) setCharacter(normalizeChar(local)); })
          .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
      }
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
  }, [id, user?.id]);

  const handleSave = async (char: Character, selectedTargetIds?: string[], opts?: { silent?: boolean }): Promise<{ cloudId?: string; syncedAt?: string } | void> => {
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
      const saved: Character = { ...char, cloudId: result.cloudId, cloudSyncedAt: result.updatedAt };
      saveLocalCharacter(saved);
      // Keep every campaign copy of this character the same
      let note = '';
      try {
        // The ticked campaign copies (all of them when the sheet has no picker)
        const sync = selectedTargetIds && selectedTargetIds.length === 0
          ? { updated: 0 }
          : await syncCharacterToCampaigns({ cloudId: result.cloudId, name: char.name, data: JSON.stringify(saved), copyIds: selectedTargetIds });
        if (sync.updated > 0) note = ` Updated ${sync.updated} campaign cop${sync.updated === 1 ? 'y' : 'ies'} too.`;
      } catch { /* the character itself saved; the campaign copies sync on the next save */ }
      if (!opts?.silent) toast.success(`Character saved to cloud!${note}`);
      return { cloudId: result.cloudId, syncedAt: result.updatedAt };
    }
    if (!opts?.silent) toast.success('Character saved locally!');
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

  return <CharacterSheet key={refreshKey} initialCharacter={character} onSave={handleSave} onHome={() => navigate('/')} syncTargets={targets} syncKey={`main:${character.id}`} />;
}
