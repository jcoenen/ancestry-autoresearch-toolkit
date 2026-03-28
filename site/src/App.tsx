import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TreeView from './pages/TreeView'
import FamilyDirectory from './pages/FamilyDirectory'
import PersonPage from './pages/PersonPage'
import SourcesPage from './pages/SourcesPage'
import SourceDetailPage from './pages/SourceDetailPage'
import MediaGallery from './pages/MediaGallery'
import TreeTestPage from './pages/TreeTestPage'
import FullLandscapePage from './pages/FullLandscapePage'
import ReportPage from './pages/ReportPage'
import ThemeMockups from './pages/ThemeMockups'
import TranslationPage from './pages/TranslationPage'
import TimelinePage from './pages/TimelinePage'
import StatsPage from './pages/StatsPage'
import OnThisDayPage from './pages/OnThisDayPage'
import ResearchGapsPage from './pages/ResearchGapsPage'
import ImmigrationPage from './pages/ImmigrationPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tree/:personId?" element={<TreeView />} />
        <Route path="/people" element={<FamilyDirectory />} />
        <Route path="/people/:slug" element={<PersonPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/sources/:slug" element={<SourceDetailPage />} />
        <Route path="/gallery" element={<MediaGallery />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/translations/:slug" element={<TranslationPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/on-this-day" element={<OnThisDayPage />} />
        <Route path="/research-gaps" element={<ResearchGapsPage />} />
        <Route path="/immigration" element={<ImmigrationPage />} />
        <Route path="/theme-mockups" element={<ThemeMockups />} />
        <Route path="/tree-test" element={<TreeTestPage />} />
        <Route path="/landscape-full" element={<FullLandscapePage />} />
      </Routes>
    </Layout>
  )
}

export default App
