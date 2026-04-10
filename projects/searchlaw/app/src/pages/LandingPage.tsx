import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/landing/HeroSection'
import DataSourcesSection from '../components/landing/DataSourcesSection'
import ReleaseNotesSection from '../components/landing/ReleaseNotesSection'

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1">
        <HeroSection />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <DataSourcesSection />
          <ReleaseNotesSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}
