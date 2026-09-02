import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getCampaignCharacters, saveCampaignCharacter } from '../lib/api/social';
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
  const [loading, setLoading] = useState(true);

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
          setCharacter({ ...parsed, weapons: parsed.weapons ?? [], bows: parsed.bows ?? [], crossbows: parsed.crossbows ?? [], berzerkActive: parsed.berzerkActive ?? false, berzerkRound: parsed.berzerkRound ?? 0, cloudId: cc.id });
          setCanEdit(cc.canEdit);
        } catch {
          toast.error('Failed to parse character data.');
          navigate(`/campaign/${campaignId}`);
        }
      })
      .catch(() => { toast.error('Failed to load character.'); navigate(`/campaign/${campaignId}`); })
      .finally(() => setLoading(false));
  }, [campaignId, characterId, navigate]);

  const handleSave = async (char: Character): Promise<{ cloudId?: string } | void> => {
    if (!characterId) return;
    await saveCampaignCharacter({
      campaignCharacterId: characterId,
      name: char.name,
      characterType: char.characterType,
      level: char.level,
      data: JSON.stringify(char),
    });
    toast.success('Campaign character saved!');
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
    />
  );
}
