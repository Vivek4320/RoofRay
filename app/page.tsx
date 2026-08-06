import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import ReportPreview from '@/components/Reportpreview';
import WhyRoofRay from '@/components/WhyRoofray';
import Footer from '@/components/Footer';
import AnimateInView from '@/components/AnimateInView';
import FAQ from '@/components/FAQ';

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen bg-background pb-16 lg:pb-0">
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
      <BottomNav />
    </main>
  );
}
