/** Per-project site configuration — loaded from site-config.json in the vault root */
export interface SiteConfig {
  /** Primary family surname (e.g. "Coenen") */
  familyName: string;
  /** Full site title (e.g. "Coenen Family Ancestry") */
  siteTitle: string;
  /** Hero subtitle paragraph — plain text description of the research scope */
  heroSubtitle: string;
  /** Name of the person who conducted the research */
  researcher: string;
  /** Short summary for footer (e.g. "11 Generations · Zeeland, Netherlands to Wisconsin, USA") */
  footerTagline: string;
  /** Year of oldest record (e.g. "1714") */
  oldestRecord: string;
  /** Number of generations traced */
  generationsTraced: number;
  /** GEDCOM ID of the root person for the patrilineal line on the homepage (e.g. "I1") */
  rootPersonId: string;
  /** Optional surname origin section for homepage */
  surnameOrigin?: {
    title: string;
    /** Markdown content — rendered with react-markdown */
    markdown: string;
  };
  /** R2 media config (optional) */
  media?: {
    r2Bucket: string;
    r2PublicUrl: string;
    cloudflareAccountId: string;
  };
}
