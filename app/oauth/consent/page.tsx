import { MeridianOAuthConsent } from "@/components/meridian-oauth-consent";

export default function MeridianOAuthConsentPage({ searchParams }: { searchParams: { authorization_id?: string } }) {
  return <MeridianOAuthConsent authorizationId={searchParams.authorization_id?.trim() ?? ""} />;
}
