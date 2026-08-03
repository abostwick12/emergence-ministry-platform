import { MinistryNarrativeSequence } from "@/components/ministry-narrative-sequence";
import type { GuestMinistryNarrative } from "@/lib/guest/ministry-narratives";

export function GuestMinistryNarrativeHub({ narratives }: { narratives: GuestMinistryNarrative[] }) {
  return (
    <section className="guest-ministry-hub" aria-label="Guest Ministry Hub narrative review">
      <header className="guest-ministry-intro">
        <p className="eyebrow">Leadership context</p>
        <h2>Shared direction before shared discernment.</h2>
        <p>
          This guest view connects leadership-authored direction to observable ministry signals, inspectable evidence,
          and questions for prayerful discussion.
        </p>
      </header>

      <section className="ministry-alignment-panel guest-ministry-alignment" aria-label="Ministry Alignment">
        <header className="ministry-alignment-header">
          <div>
            <p className="eyebrow">Current Season</p>
            <h3>Scripture Engagement</h3>
          </div>
          <span className="guest-ministry-readonly">Guest view · Read only</span>
        </header>

        <div className="ministry-alignment-statement-row" aria-label="Vision and mission">
          <div className="ministry-alignment-block ministry-alignment-quote-block">
            <span>Vision</span>
            <p>Students become lifelong disciples of Jesus who love Scripture, live in community, and serve with courage.</p>
          </div>
          <div className="ministry-alignment-block ministry-alignment-quote-block">
            <span>Mission</span>
            <p>Reduce administrative friction so ministry leaders can spend more time forming students as disciples.</p>
          </div>
        </div>

        <div className="ministry-alignment-grid">
          <div className="ministry-alignment-block ministry-alignment-list-card">
            <span>Values</span>
            <ul>
              <li><strong>Scripture First</strong></li>
              <li><strong>Formation Over Activity</strong></li>
              <li><strong>Care for Leaders</strong></li>
            </ul>
          </div>
          <div className="ministry-alignment-block ministry-alignment-list-card ministry-alignment-success-card">
            <span>Success Looks Like</span>
            <ul>
              <li>Students engage Scripture outside scheduled programs.</li>
              <li>Small groups move from discussion into spiritual practice.</li>
              <li>Leaders report deeper and more consistent discipleship conversations.</li>
              <li>Families reinforce spiritual rhythms at home.</li>
            </ul>
          </div>
        </div>
      </section>

      <MinistryNarrativeSequence mode="guest" narratives={narratives} />
    </section>
  );
}
