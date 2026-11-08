'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Backpack, BookOpen, Crosshair, Info, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { RESOURCES, type ResourceCategory } from '../../lib/resources';
import { PageTitle } from './ui';

const ICONS: Record<ResourceCategory['icon'], React.ReactNode> = {
  crosshair: <Crosshair size={20} />,
  backpack: <Backpack size={20} />,
  trophy: <Trophy size={20} />,
  shield: <ShieldCheck size={20} />,
  user: <UserRound size={20} />,
  info: <Info size={20} />,
};

export default function Resources() {
  const [open, setOpen] = useState<string | null>(null);
  const listing = useRef<HTMLElement>(null);
  const category = RESOURCES.categories.find(c => c.id === open);

  useEffect(() => {
    if (open) listing.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [open]);

  return (
    <div>
      <PageTitle eyebrow="REFERENCE" title={RESOURCES.heading}>{RESOURCES.introduction}</PageTitle>
      <div className="resourceNotice"><p>{RESOURCES.notice}</p></div>

      <div className="resourceTiles">
        {RESOURCES.categories.map(c => (
          <button key={c.id} className="resourceTile" aria-pressed={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
            <span className="resourceIcon">{ICONS[c.icon]}</span>
            <span className="resourceTileTitle">{c.title}</span>
            <span className="resourceTileText">{c.description}</span>
            <span className="resourceTileAction">{open === c.id ? 'Close' : `${c.guides.length || c.topics.length} ${c.guides.length ? 'guides' : 'topics'}`} <ArrowRight size={14} /></span>
          </button>
        ))}
      </div>

      {category && (
        <section ref={listing} className="panel resourceListing">
          <div className="sectionTitle"><h2>{category.title}</h2></div>
          <p className="formNote">{category.description}</p>
          <ul className="resourceTopics">{category.topics.map(t => <li key={t}>{t}</li>)}</ul>
          {category.guides.length === 0 ? (
            <div className="empty"><BookOpen size={20} /><h3>Guides coming soon</h3><p>The topics above are planned for this section.</p></div>
          ) : category.guides.map(g => (
            <details key={g.id} className="guide">
              <summary><strong>{g.title}</strong><small>{g.summary}</small></summary>
              {g.body && <div className="pre guideBody">{g.body}</div>}
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
