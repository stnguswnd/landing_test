import { Contact } from "@/components/landing/contact";
import { Curriculum } from "@/components/landing/curriculum";
import { Hero } from "@/components/landing/hero";
import { Points } from "@/components/landing/points";
import { Roadmap } from "@/components/landing/roadmap";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import { TeacherProfile } from "@/components/landing/teacher-profile";
import { Footer } from "@/components/layout/footer";
import { MobileStickyCta } from "@/components/layout/mobile-sticky-cta";
import { SectionNav } from "@/components/layout/section-nav";
import { siteConfig } from "@/lib/seo";
import { contact } from "@/content/landing";

export default function HomePage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: siteConfig.name,
    description: siteConfig.description,
    telephone: contact.phone,
    url: siteConfig.url,
  };

  return (
    <>
      <main className="page-shell">
        <SectionNav />
        <Hero />
        <TeacherProfile />
        <Curriculum />
        <Roadmap />
        <Points />
        <ShowcaseCarousel />
        <Contact />
        <MobileStickyCta />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  );
}
