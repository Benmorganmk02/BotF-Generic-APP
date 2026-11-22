import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getCampaignCharacters, saveCampaignCharacter, syncCampaignCharacterToOriginal, getLinkedSheetsForCopy } from '../lib/api/social';
import type { SyncTarget } from '../components/sheet/SaveTargetsMenu';
import { getLocalCharacter, saveLocalCharacter } from '../utils/storage';
import { Character } from '../types/character';
import CharacterSheet from '../components/CharacterSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function CampaignCharacterPage() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [campaignWorld, setCampaignWorld] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  // The main character and the other campaign copies a save can also update
  const [targets, setTargets] = useState<SyncTarget[]>([]);

  useEffect(() => {
    if (!campaignId || !characterId) { navigate('/'); return; }
    getCampaignCharacters({ campaignId })
      .then(r => {
        const cc = r.characters.find(c => c.id === characterId);
        if (!cc) { toast.error('Character not found.'); navigate(`/campaign/${campaignId}`); return; }
        if (!cc.canEdit) { toast.error('You do not have permission to edit this character.'); navigate(`/campaign/${campaignId}`); return; }
        try {
          const parsed = JSON.parse(cc.data) as Character;
          // Use the campaign character id as the "cloudId" so saves go back correctly
          setCharacter({ ...parsed, weapons: parsed.weapons ?? [], bows: parsed.bows ?? [], crossbows: parsed.crossbows ?? [], firearms: parsed.firearms ?? [], berzerkActive: parsed.berzerkActive ?? false, berzerkRound: parsed.berzerkRound ?? 0, cloudId: cc.id });
          setCanEdit(cc.canEdit);
          setCampaignWorld(r.campaign.world);
        } catch {
          toast.error('Failed to parse character data.');
          navigate(`/campaign/${campaignId}`);
        }
      })
      .catch(() => { toast.error('Failed to load character.'); navigate(`/campaign/${campaignId}`); })
      .finally(() => setLoading(false));
  }, [campaignId, characterId, navigate]);

  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;
    getLinkedSheetsForCopy({ campaignCharacterId: characterId })
      .then(l => {
        if (cancelled) return;
        const t: SyncTarget[] = [];
        if (l.originalId) t.push({ id: 'main', kind: 'main', label: 'Main character' });
        l.others.forEach(o => t.push({ id: o.id, kind: 'campaign', label: `Campaign: ${o.campaignName}` }));
        setTargets(t);
      })
      .catch(() => { if (!cancelled) setTargets([]); });
    return () => { cancelled = true; };
  }, [characterId]);

  // The "main character was not updated" warning is shown once per visit, not on every auto-save
  const warnedBlocked = useRef(false);

  const handleSave = async (char: Character, selectedTargetIds?: string[], opts?: { silent?: boolean }): Promise<{ cloudId?: string; syncedAt?: string } | void> => {
    if (!characterId) return;
    const say = (fn: () => void) => { if (!opts?.silent) fn(); };
    await saveCampaignCharacter({
      campaignCharacterId: characterId,
      name: char.name,
      characterType: char.characterType,
      level: char.level,
      data: JSON.stringify(char),
    });
    // The campaign copy and the main character are the same character: copy this save onto the main one
    // (and onto its other campaign copies).
    try {
      const sync = await syncCampaignCharacterToOriginal({
        campaignCharacterId: characterId, name: char.name, characterType: char.characterType, level: char.level, data: JSON.stringify(char),
        // The ticked sheets (everything when the sheet has no picker)
        updateMain: selectedTargetIds ? selectedTargetIds.includes('main') : true,
        copyIds: selectedTargetIds?.filter(id => id !== 'main'),
      });
      if (sync.originalUpdated) {
        // If the main character is also stored on this device, bring it up to date as well
        if (getLocalCharacter(char.id)) saveLocalCharacter({ ...char, cloudId: sync.originalId, cloudSyncedAt: sync.updatedAt });
        const extra = sync.otherCopiesUpdated > 0 ? ` and ${sync.otherCopiesUpdated} other campaign cop${sync.otherCopiesUpdated === 1 ? 'y' : 'ies'}` : '';
        say(() => toast.success(`Campaign character saved! The main character${extra} updated too.`));
      } else if (sync.mainSkipped) {
        const extra = sync.otherCopiesUpdated > 0 ? ` ${sync.otherCopiesUpdated} other campaign cop${sync.otherCopiesUpdated === 1 ? 'y was' : 'ies were'} updated.` : '';
        say(() => toast.success(`Campaign character saved! The main character was left as it is.${extra}`));
      } else if (sync.linked) {
        if (opts?.silent && warnedBlocked.current) return;
        warnedBlocked.current = true;
        toast.warning('Saved to the campaign, but the main character was not updated.', {
          description: "The database doesn't allow a GM to edit a player's main character yet. Run supabase/campaign-sync.sql in the Supabase SQL editor.",
          duration: 9000,
        });
      } else {
        say(() => toast.success('Campaign character saved!'));
      }
    } catch {
      say(() => toast.success('Campaign character saved!'));
    }
  };

  if (loading || !character) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  return (
    <CharacterSheet
      initialCharacter={character}
      onSave={handleSave}
      onHome={() => navigate(`/campaign/${campaignId}`)}
      campaignMode
      syncTargets={targets}
      syncKey={`copy:${characterId}`}
      campaignWorld={campaignWorld}
    />
  );
}
