import { notFound } from "next/navigation";
import { BookOpen, Headphones, Image as ImageIcon, PlayCircle, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

import { HowToReadGuideActions } from "@/components/student/how-to-read-guide-actions";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
import { getServerSession } from "@/lib/auth/server";
import { getHowToReadModule, howToReadModules } from "@/lib/scripture/how-to-read";
import { getStudentHowToReadProgress } from "@/lib/scripture/how-to-read-progress";
import { getEmbeddableVideoUrl } from "@/lib/scripture/video-embed";
import { resolveStudentHubAccess } from "@/lib/student/access";

type HowToReadGuidePageProps = {
  params: {
    moduleId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function HowToReadGuidePage({ params }: HowToReadGuidePageProps) {
  const guide = getHowToReadModule(params.moduleId);
  if (!guide) notFound();

  const access = resolveStudentHubAccess(await getServerSession());
  const progress = access.allowed ? await getStudentHowToReadProgress(access.session) : undefined;
  const isComplete = progress?.completedModuleIds.includes(guide.id) ?? false;
  const guideIndex = howToReadModules.findIndex((module) => module.id === guide.id);
  const previousGuide = guideIndex > 0 ? howToReadModules[guideIndex - 1] : undefined;
  const nextGuide = guideIndex >= 0 && guideIndex < howToReadModules.length - 1 ? howToReadModules[guideIndex + 1] : undefined;

  return (
    <>
      <StudentScriptureTabs active="how-to-read" />
      <article className="how-to-read-guide-detail" aria-labelledby="how-to-read-guide-title">
        <header className="how-to-read-guide-hero">
          <div>
            <p className="eyebrow">
              Guide {guide.order} - {guide.minutes} min
            </p>
            <h1 id="how-to-read-guide-title">{guide.title}</h1>
            <p>{guide.summary}</p>
          </div>
          <aside className="how-to-read-guide-status" aria-label="Guide status">
            <span className={isComplete ? "pill green" : "pill blue"}>{isComplete ? "Signed off" : "In progress"}</span>
            <strong>{guide.badge}</strong>
            <p>{isComplete ? "You have already signed this guide off." : "Use the sign-off below when you are ready to mark this guide complete."}</p>
          </aside>
        </header>

        <section className="how-to-read-guide-section how-to-read-guide-takeaway" aria-label="Main idea">
          <p className="eyebrow">Start here</p>
          <h2>The main idea</h2>
          <p>{guide.studentTakeaway}</p>
        </section>

        <section className="how-to-read-guide-media" aria-label="Media and infographic slots">
          <MediaSlot embedUrl={guide.videoEmbedUrl} icon={<PlayCircle size={18} aria-hidden="true" />} label="Video" title={guide.videoLabel} />
          <MediaSlot icon={<Headphones size={18} aria-hidden="true" />} label="Audio" title="Podcast or audio guide slot" />
          <MediaSlot icon={<ImageIcon size={18} aria-hidden="true" />} label="Infographic" title={guide.infographicLabel} />
        </section>

        <section className="how-to-read-guide-grid" aria-label="Guide practice">
          <div className="how-to-read-guide-section">
            <h2>
              <BookOpen size={18} aria-hidden="true" />
              Key passages
            </h2>
            <div className="how-to-read-guide-passages">
              {guide.keyPassages.map((passage) => (
                <span key={passage}>{passage}</span>
              ))}
            </div>
          </div>

          <div className="how-to-read-guide-section">
            <h2>
              <ShieldCheck size={18} aria-hidden="true" />
              Read with care
            </h2>
            <ul>
              {guide.tools.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </div>

          <div className="how-to-read-guide-section">
            <h2>
              <BookOpen size={18} aria-hidden="true" />
              Try this
            </h2>
            <p>{guide.practice}</p>
          </div>

          <div className="how-to-read-guide-section">
            <h2>
              <Users size={18} aria-hidden="true" />
              Bring to group
            </h2>
            <p>{guide.groupQuestion}</p>
          </div>
        </section>

        <section className="how-to-read-guide-section how-to-read-guide-note" aria-label="Student-level note">
          <p className="eyebrow">For this path</p>
          <h2>Clear enough to use this week.</h2>
          <p>
            These guides are short summaries for students and seekers. Deeper study can support them later, but this page is meant to be understandable,
            useful, and safe to bring into a high school small group.
          </p>
        </section>

        <HowToReadGuideActions
          initialComplete={isComplete}
          initialProgressStorage={progress?.storage ?? "unavailable"}
          moduleId={guide.id}
          nextGuideHref={nextGuide ? `/student/scripture/how-to-read/${nextGuide.id}` : undefined}
          previousGuideHref={previousGuide ? `/student/scripture/how-to-read/${previousGuide.id}` : undefined}
        />
      </article>
    </>
  );
}

function MediaSlot({ embedUrl, icon, label, title }: { embedUrl?: string; icon: ReactNode; label: string; title: string }) {
  const videoUrl = getEmbeddableVideoUrl(embedUrl);

  return (
    <div className="how-to-read-guide-media-slot">
      {videoUrl ? (
        <div className="how-to-read-guide-video">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            src={videoUrl}
            title={title}
          />
        </div>
      ) : (
        <span className="how-to-read-guide-media-icon">{icon}</span>
      )}
      <div>
        <p className="eyebrow">{label}</p>
        <h2>{title}</h2>
        <p>{videoUrl ? "Watch this, then use the questions below to process it." : "Coming later. This slot is ready for your short teaching, audio, or visual summary."}</p>
      </div>
    </div>
  );
}
