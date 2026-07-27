import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import ReportPreview from '@/components/Reportpreview';
import WhyRoofRay from '@/components/WhyRoofray';
import Footer from '@/components/Footer';
import AnimateInView from '@/components/AnimateInView';
import FAQ from '@/components/FAQ';

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <AnimateInView>
        <HowItWorks />
      </AnimateInView>
      <AnimateInView delay={100}>
        <ReportPreview />
      </AnimateInView>
      <AnimateInView>
        <WhyRoofRay />
      </AnimateInView>
      <AnimateInView>
        <FAQ />
      </AnimateInView>
      <Footer />
    </main>
  );
}
