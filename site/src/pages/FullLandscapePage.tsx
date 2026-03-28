import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePeople } from '../useData'
import { LandscapePedigree, buildGenderMap } from './TreeView'

export default function FullLandscapePage() {
  const people = usePeople()
  const navigate = useNavigate()
  const genderMap = useMemo(() => buildGenderMap(people), [people])

  const handleNavigate = useCallback((id: string) => {
    navigate(`/tree/${id}`)
  }, [navigate])

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-stone-800">Full Landscape Pedigree</h1>
        <p className="mt-1 text-stone-500">
          All ancestors expanded — landscape layout test page.
          <span className="ml-4 text-xs">
            <span className="inline-block w-3 h-0.5 bg-blue-400 mr-1 align-middle" />paternal
            <span className="inline-block w-3 h-0.5 bg-pink-400 ml-3 mr-1 align-middle" />maternal
          </span>
        </p>
      </div>
      <LandscapePedigree
        focusId="I1"
        people={people}
        genderMap={genderMap}
        onNavigate={handleNavigate}
        initialExpandDepth={20}
      />
    </div>
  )
}
