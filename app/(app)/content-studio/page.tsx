import { ContentStudioPage } from "@/components/content-studio/content-studio-page";
import { getServerSession } from "@/lib/auth/server";
import { loadContentStudioWorkspace } from "@/lib/meridian/content-studio/web";

export default async function ContentStudioRoute() {
  const session = await getServerSession();
  if (!session) return null;

  try {
    const workspace = await loadContentStudioWorkspace(session);
    return <ContentStudioPage workspace={workspace} />;
  } catch (error) {
    return (
      <main className="content-studio-page">
        <section className="content-studio-unavailable panel">
          <p className="eyebrow">Meridian Content Studio</p>
          <h2>Content Studio needs Meridian access</h2>
          <p>{error instanceof Error ? error.message : "The Meridian content workspace is not available for this account yet."}</p>
          <p className="content-studio-safety-note">No draft was published, sent, scheduled, or changed.</p>
        </section>
      </main>
    );
  }
}
