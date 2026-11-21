import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getVisibleCampaignCharacters } from '../lib/api/social';
import type { VisibleCampaignCharacter } from '../lib/api/social';
import type { Character } from '../types/character';
import { visibilityLabel } from '../utils/visibility';
import CharacterSheet from '../components/CharacterSheet';
import CharacterSummary from '../components/sheet/CharacterSummary';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

/** A campaign character someone else made visible to you: a summary at Basics or Stats, the whole sheet (view only) at Full. */
export default function CampaignViewPage() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const navigate = useNavigate();
  const [char, setChar] = useState<VisibleCampaignCharacter | null>(null);
  const [parsed, setParsed] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const back = () => navigate(`/campaign/${campaignId}`);

  useEffect(() => {
    if (!campaignId || !characterId) { navigate('/'); return; }
    getVisibleCampaignCharacters({ campaignId })
      .then(r => {
        const match = r.find(c => c.id === characterId);
        if (!match) { toast.error('That character is not visible to you.'); navigate(`/campaign/${campaignId}`); return; }
        try { setParsed(JSON.parse(match.data)); setChar(match); }
        catch { toast.error('Failed to read that character.'); navigate(`/campaign/${campaignId}`); }
      })
      .catch((e: any) => { toast.error(e.message ?? 'Failed to load character.'); navigate(`/campaign/${campaignId}`); })
      .finally(() => setLoading(false));
  }, [campaignId, characterId, navigate]);

  if (loading || !char || !parsed) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  if (char.visibility === 'full') {
    const p = parsed as Character;
    const full: Character = {
      ...p,
      weapons: p.weapons ?? [], bows: p.bows ?? [], crossbows: p.crossbows ?? [], firearms: p.firearms ?? [],
      berzerkActive: p.berzerkActive ?? false, berzerkRound: p.berzerkRound ?? 0,
    };
    return <CharacterSheet initialCharacter={full} onSave={async () => {}} onHome={back} readOnly />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={back}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-base font-bold text-foreground truncate">{char.name}</h1>
        <Badge variant="outline" className="text-xs">{visibilityLabel(char.visibility)} · view only</Badge>
        {char.playerEmail && <span className="text-xs text-muted-foreground truncate">{char.playerEmail}</span>}
      </div>
      <CharacterSummary data={parsed} level={char.visibility === 'stats' ? 'stats' : 'basic'} />
    </div>
  );
}
