import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'
import FamilyDirectory from './pages/FamilyDirectory'
import PersonPage from './pages/PersonPage'
import SourcesPage from './pages/SourcesPage'
import SourceDetailPage from './pages/SourceDetailPage'
import MediaGallery from './pages/MediaGallery'
import ReportPage from './pages/ReportPage'
import ThemeMockups from './pages/ThemeMockups'
import TranslationPage from './pages/TranslationPage'
import TimelinePage from './pages/TimelinePage'
import StatsPage from './pages/StatsPage'
import OnThisDayPage from './pages/OnThisDayPage'
import ResearchGapsPage from './pages/ResearchGapsPage'
import ImmigrationPage from './pages/ImmigrationPage'
import SearchPage from './pages/SearchPage'
import UpdatesPage from './pages/UpdatesPage'
import VerticalTreePrototypes from './pages/VerticalTreePrototypes'
import FamilyMapPage from './pages/FamilyMapPage'
import FeaturesPage from './pages/FeaturesPage'
import CemeteryBrowserPage from './pages/CemeteryBrowserPage'
import RecentAdditionsPage from './pages/RecentAdditionsPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  return (
    <Layout>
      <ScrollToTop />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tree/:personId?" element={<ErrorBoundary fallbackTitle="Tree view failed to render"><VerticalTreePrototypes /></ErrorBoundary>} />
          <Route path="/people" element={<FamilyDirectory />} />
          <Route path="/people/:slug" element={<ErrorBoundary fallbackTitle="Person page failed to render"><PersonPage /></ErrorBoundary>} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/sources/:slug" element={<SourceDetailPage />} />
          <Route path="/gallery" element={<MediaGallery />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/translations/:slug" element={<TranslationPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/on-this-day" element={<OnThisDayPage />} />
          <Route path="/research-gaps" element={<ResearchGapsPage />} />
          <Route path="/immigration" element={<ImmigrationPage />} />
          <Route path="/map" element={<FamilyMapPage />} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/cemeteries" element={<CemeteryBrowserPage />} />
          <Route path="/recent" element={<RecentAdditionsPage />} />
          <Route path="/theme-mockups" element={<ThemeMockups />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  )
}

export default App
