import type { Metadata } from "next";

import { HeroSection } from "./landing/hero-section";
import { LandingFooter } from "./landing/landing-footer";
import { LandingHeader } from "./landing/landing-header";
import { AudienceSection, FinalCtaSection, MobileFirstSection, TrustSection } from "./landing/outcome-sections";
import { CoreModulesSection, QuestionsSection, WorkflowSection } from "./landing/product-story-sections";

export const metadata: Metadata = {
  title: "PCON Project Control | คุมโครงการ BOQ และ Daily Report",
  description: "บริหารโครงการก่อสร้าง BOQ ความคืบหน้า และ Daily Report ในระบบเดียว สำหรับผู้รับเหมาและทีมก่อสร้างไทย",
  openGraph: {
    title: "PCON Project Control | คุมทุกไซต์ในที่เดียว",
    description: "เชื่อมข้อมูล Project, BOQ และ Daily Report ระหว่างทีมหน้างานกับออฟฟิศ",
    locale: "th_TH",
    siteName: "PCON Project Control",
    type: "website"
  }
};

export default function Home() {
  return (
    <>
      <LandingHeader />
      <main data-landing-page className="w-full max-w-full overflow-x-hidden bg-[#f5f7f4] text-slate-950">
        <HeroSection />
        <QuestionsSection />
        <CoreModulesSection />
        <WorkflowSection />
        <MobileFirstSection />
        <AudienceSection />
        <TrustSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </>
  );
}
