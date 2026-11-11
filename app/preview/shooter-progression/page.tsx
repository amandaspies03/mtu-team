import { Crosshair, Target } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Scorecard } from '../../views/shooter-progression';

export const dynamic = 'force-dynamic';

export default function ShooterProgressionPreview() {
  if (process.env.VERCEL_ENV !== 'preview') notFound();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandIcon"><Crosshair size={22} /></span>
          <span><b>184th MTU</b><br />Team Manager</span>
        </div>
        <span className="mobileTitle">Shooter Progression</span>
        <div className="navPanel">
          <nav aria-label="Preview navigation">
            <button className="active" type="button" aria-current="page">
              <Target size={18} /><span>Shooter Progression</span>
            </button>
          </nav>
        </div>
      </aside>
      <main>
        <Scorecard storageKey="mtu.man-card.preview" shooter="Sample Shooter" />
      </main>
    </div>
  );
}
