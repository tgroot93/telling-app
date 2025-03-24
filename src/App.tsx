import { useState, useEffect, useMemo, Fragment } from 'react'
import { Drank, Telling, DrankTotaal, RondeOverzicht, Locatie } from './types'

function App() {
  const [dranken, setDranken] = useState<Drank[]>([])
  const [locaties, setLocaties] = useState<Locatie[]>([])
  const [tellingen, setTellingen] = useState<Telling[]>([])
  const [actieveTab, setActieveTab] = useState(0)
  const [toonResetBevestiging, setToonResetBevestiging] = useState(false)
  const [toonAlleenTeBestellen, setToonAlleenTeBestellen] = useState(false)
  const [geselecteerdeDrank, setGeselecteerdeDrank] = useState<Drank | null>(null)
  const [actieveInputId, setActieveInputId] = useState<string | null>(null)

  // Laad de CSV data
  useEffect(() => {
    const laadCSV = async () => {
      try {
        // Vaste locaties instellen
        const vasteLocaties: Locatie[] = [
          { id: 'koeling', naam: 'Koeling', volgorde: 1 },
          { id: 'kast', naam: 'Kast', volgorde: 2 },
          { id: 'container', naam: 'Container', volgorde: 3 }
        ]
        setLocaties(vasteLocaties)

        const response = await fetch('/data.csv')
        if (!response.ok) throw new Error('CSV kon niet worden geladen')
        const csvData = await response.text()
        const lines = csvData.split('\n')
        
        const drankenData: Drank[] = []
        let huidigeCategorie = ''
        
        // Functie om de juiste locatie voor een categorie te bepalen
        const bepaalLocatie = (categorie: string): string => {
          if (categorie === 'BACKSTAGE') {
            return 'koeling'
          }
          if (categorie === 'STERK' || 
              categorie === 'SEIZOENSWIJNEN - ROOD' || 
              categorie === 'WIJNEN - ROOD') {
            return 'kast'
          }
          return 'koeling'
        }
        
        lines.forEach((line) => {
          const [naam, minimumVoorraad] = line.split(',').map(s => s.trim())
          if (!naam) return
          
          if (naam === naam.toUpperCase() && !minimumVoorraad) {
            huidigeCategorie = naam
            return
          }
          
          if (minimumVoorraad && !isNaN(parseInt(minimumVoorraad))) {
            const baseId = naam.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            const locatie = bepaalLocatie(huidigeCategorie)
            
            drankenData.push({
              id: locatie === 'koeling' ? `${baseId}-koeling` : baseId,
              naam,
              minimumVoorraad: parseInt(minimumVoorraad),
              locatieId: locatie,
              categorie: huidigeCategorie,
              eenheid: huidigeCategorie.includes('WIJN') ? 'flessen' : 'stuks'
            })
            
            if (locatie === 'koeling' && 
                !['BACKSTAGE', 'STERK', 'SEIZOENSWIJNEN - ROOD', 'WIJNEN - ROOD'].includes(huidigeCategorie)) {
              drankenData.push({
                id: `${baseId}-container`,
                naam,
                minimumVoorraad: parseInt(minimumVoorraad),
                locatieId: 'container',
                categorie: huidigeCategorie,
                eenheid: huidigeCategorie.includes('WIJN') ? 'flessen' : 'stuks'
              })
            }
          }
        })
        
        setDranken(drankenData)
      } catch (error) {
        console.error('Error loading CSV:', error)
      }
    }
    
    laadCSV()
  }, [])

  // Bereken het totaal overzicht
  const berekenOverzicht = useMemo<DrankTotaal[]>(() => {
    // Groepeer dranken op naam
    const drankenPerNaam = dranken.reduce((acc, drank) => {
      if (!acc[drank.naam]) {
        acc[drank.naam] = {
          drank: drank,
          tellingen: []
        }
      }
      // Voeg alle tellingen toe van dit product
      acc[drank.naam].tellingen.push(...tellingen.filter(t => t.drankId === drank.id))
      return acc
    }, {} as Record<string, { drank: Drank, tellingen: Telling[] }>)

    // Bereken het totaal voor elke unieke drank
    return Object.values(drankenPerNaam).map(({ drank, tellingen }) => {
      const totaalAantal = tellingen.reduce((sum, t) => sum + t.aantal, 0)
      const teBestellen = Math.max(0, drank.minimumVoorraad - totaalAantal)

      return {
        drankId: drank.id,
        naam: drank.naam,
        minimumVoorraad: drank.minimumVoorraad,
        eenheid: drank.eenheid,
        totaalAantal,
        teBestellen,
        categorie: drank.categorie
      }
    })
  }, [dranken, tellingen])

  // Bereken het overzicht per ronde
  const rondeOverzicht = useMemo<RondeOverzicht[]>(() => {
    return locaties.map((locatie, index) => {
      const drankenInRonde = dranken.filter(d => d.locatieId === locatie.id)
      const geteld = tellingen.filter(t => 
        drankenInRonde.some(d => d.id === t.drankId)
      )

      return {
        ronde: index + 1,
        geteld
      }
    })
  }, [locaties, dranken, tellingen])

  // Reset alle tellingen
  const handleReset = () => {
    setTellingen([])
    setToonResetBevestiging(false)
  }

  // Exporteer naar CSV
  const handleExport = () => {
    const overzicht = berekenOverzicht
    const csvRows = overzicht
      .filter(item => !toonAlleenTeBestellen || item.teBestellen > 0)
      .map(item => {
        const { naam, categorie, totaalAantal, minimumVoorraad, teBestellen } = item
        return `${naam},${categorie || ''},${totaalAantal},${minimumVoorraad},${teBestellen}`
      })
      .join('\n')

    const csvContent = `Naam,Categorie,Totaal,Minimum,Te bestellen\n${csvRows}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    
    // Voeg de datum toe aan de bestandsnaam
    const vandaag = new Date()
    const datum = vandaag.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-')
    
    link.download = `telling-${datum}.csv`
    link.click()
  }

  // Verwerk een telling
  const handleInvoer = (drankId: string, waarde: string) => {
    const aantal = waarde ? parseInt(waarde) : 0
    const bestaandeTellingIndex = tellingen.findIndex(t => 
      t.drankId === drankId && 
      t.locatieId === locaties[actieveTab].id &&
      t.ronde === actieveTab + 1
    )
    
    if (bestaandeTellingIndex !== -1) {
      const nieuweTellingen = [...tellingen]
      nieuweTellingen[bestaandeTellingIndex] = { 
        ...nieuweTellingen[bestaandeTellingIndex], 
        aantal 
      }
      setTellingen(nieuweTellingen)
    } else {
      const nieuweTelling: Telling = {
        drankId,
        aantal,
        ronde: actieveTab + 1,
        locatieId: locaties[actieveTab].id
      }
      setTellingen([...tellingen, nieuweTelling])
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 bg-white shadow-md z-20">
        <div className="max-w-md mx-auto p-4">
          <div className="flex flex-wrap justify-between gap-1">
            {locaties.map((locatie, index) => (
              <button
                key={locatie.id}
                onClick={() => setActieveTab(index)}
                style={{
                  backgroundColor: actieveTab === index ? '#3b82f6' : '#eff6ff',
                  color: actieveTab === index ? 'white' : '#1e40af',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  transition: 'all 0.2s',
                  boxShadow: actieveTab === index ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  fontSize: '0.75rem',
                  flex: 1,
                  minWidth: '0'
                }}
                className="hover:opacity-90 truncate"
              >
                {locatie.naam === 'Cooler' ? 'Koeling' : locatie.naam === 'Opslagkast' ? 'Kast' : locatie.naam}
              </button>
            ))}
            <button
              onClick={() => setActieveTab(locaties.length)}
              style={{
                backgroundColor: actieveTab === locaties.length ? '#3b82f6' : '#eff6ff',
                color: actieveTab === locaties.length ? 'white' : '#1e40af',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                transition: 'all 0.2s',
                boxShadow: actieveTab === locaties.length ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: '0.75rem',
                flex: 1,
                minWidth: '0'
              }}
              className="hover:opacity-90 truncate"
            >
              Overzicht
            </button>
            <button
              onClick={() => setToonResetBevestiging(true)}
              className="ml-2 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
              title="Reset tellingen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Reset bevestigingspopup */}
      {toonResetBevestiging && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setToonResetBevestiging(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Reset tellingen</h3>
            <p className="text-slate-600 mb-6">Weet je zeker dat je alle tellingen wilt resetten? Dit kan niet ongedaan worden gemaakt.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setToonResetBevestiging(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Annuleren
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Resetten
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          {actieveTab === locaties.length ? (
            <div className="space-y-4 pb-20">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Artikel
                      </th>
                      <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Min
                      </th>
                      <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Best
                      </th>
                      <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      const itemsPerCategorie = berekenOverzicht
                        .filter(item => !toonAlleenTeBestellen || item.teBestellen > 0)
                        .reduce((acc, item) => {
                          const cat = item.categorie || 'Overig'
                          if (!acc[cat]) acc[cat] = []
                          acc[cat].push(item)
                          return acc
                        }, {} as Record<string, DrankTotaal[]>)

                      return Object.entries(itemsPerCategorie).map(([categorie, items]) => (
                        <Fragment key={categorie}>
                          <tr className="bg-blue-50">
                            <td colSpan={5} className="px-6 py-2 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">
                              {categorie}
                            </td>
                          </tr>
                          {items.map((item) => (
                            <tr key={item.drankId} className="hover:bg-gray-50">
                              <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.naam}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                {item.totaalAantal}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                {item.minimumVoorraad}
                              </td>
                              <td className={`px-2 py-3 whitespace-nowrap text-sm text-center ${
                                item.teBestellen > 0 
                                  ? 'text-red-700 bg-red-50 font-medium rounded-lg' 
                                  : 'text-gray-500'
                              }`}>
                                {item.teBestellen}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500">
                                <button
                                  onClick={() => {
                                    const drank = dranken.find(d => d.id === item.drankId)
                                    if (drank) {
                                      setGeselecteerdeDrank(drank)
                                    }
                                  }}
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-4 pb-20">
              {(() => {
                const drankenInLocatie = dranken.filter(d => d.locatieId === locaties[actieveTab].id)
                const drankenPerCategorie = drankenInLocatie.reduce((acc, drank) => {
                  if (!acc[drank.categorie]) {
                    acc[drank.categorie] = []
                  }
                  acc[drank.categorie].push(drank)
                  return acc
                }, {} as Record<string, Drank[]>)

                // Maak één platte lijst van alle dranken met hun categorieën
                const alleDranken = Object.entries(drankenPerCategorie).flatMap(([categorie, dranken]) => 
                  dranken.map(drank => ({ ...drank, categorie }))
                )

                // Render de categorieën en dranken
                return (
                  <div className="space-y-4">
                    {Object.entries(drankenPerCategorie).map(([categorie, dranken]) => (
                      <Fragment key={categorie}>
                        <div className="bg-slate-100 px-4 py-2 rounded-lg">
                          <h3 className="font-medium text-slate-700">{categorie}</h3>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                          <div className="divide-y divide-slate-100">
                            {dranken.map((drank, index) => (
                              <div
                                key={drank.id}
                                className={`flex justify-between items-center p-4 cursor-pointer transition-colors ${
                                  actieveInputId === drank.id 
                                    ? 'bg-blue-50' 
                                    : tellingen.some(t => 
                                        t.drankId === drank.id && 
                                        t.locatieId === locaties[actieveTab].id &&
                                        t.ronde === actieveTab + 1
                                      )
                                    ? 'bg-green-50'
                                    : 'hover:bg-slate-50'
                                }`}
                                onClick={() => {
                                  const input = document.querySelector(`input[data-drank-id="${drank.id}"]`) as HTMLInputElement
                                  input?.focus()
                                }}
                              >
                                <div>
                                  <h4 className="font-medium text-slate-900">{drank.naam}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={tellingen.find(t => 
                                      t.drankId === drank.id && 
                                      t.locatieId === locaties[actieveTab].id &&
                                      t.ronde === actieveTab + 1
                                    )?.aantal || ''}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/[^0-9]/g, '')
                                      handleInvoer(drank.id, value)
                                    }}
                                    onFocus={() => {
                                      setActieveInputId(drank.id)
                                      // Scroll het element in beeld
                                      const element = document.querySelector(`input[data-drank-id="${drank.id}"]`)?.parentElement?.parentElement
                                      if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                      }
                                    }}
                                    onBlur={() => setActieveInputId(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        
                                        // Vind de huidige index in de platte lijst
                                        const huidigeIndex = alleDranken.findIndex(d => d.id === drank.id)
                                        
                                        // Ga naar de volgende drank, of terug naar het begin als we aan het einde zijn
                                        const volgendeIndex = (huidigeIndex + 1) % alleDranken.length
                                        const volgendeDrank = alleDranken[volgendeIndex]
                                        
                                        const input = document.querySelector(`input[data-drank-id="${volgendeDrank.id}"]`) as HTMLInputElement
                                        input?.focus()
                                      }
                                    }}
                                    data-drank-id={drank.id}
                                    className="w-16 h-8 px-2 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors text-center"
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {actieveTab === locaties.length && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg z-50">
              <div className="max-w-md mx-auto flex justify-between items-center">
                <button 
                  style={{
                    backgroundColor: toonAlleenTeBestellen ? '#3b82f6' : '#eff6ff',
                    color: toonAlleenTeBestellen ? 'white' : '#1e40af',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s',
                    boxShadow: toonAlleenTeBestellen ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    fontSize: '0.875rem'
                  }}
                  className="hover:opacity-90"
                  onClick={() => setToonAlleenTeBestellen(!toonAlleenTeBestellen)}
                >
                  {toonAlleenTeBestellen ? 'Toon alle artikelen' : 'Toon alleen te bestellen'}
                </button>
                <button 
                  onClick={handleExport}
                  className="inline-flex items-center justify-center w-12 h-12 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                  title="Exporteer naar CSV"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details popup */}
      {geselecteerdeDrank && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{geselecteerdeDrank.naam}</h3>
              <button
                onClick={() => setGeselecteerdeDrank(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Tellingen per locatie</h4>
                <div className="space-y-2">
                  {locaties
                    .filter(locatie => 
                      dranken.some(d => 
                        d.naam === geselecteerdeDrank.naam && 
                        d.locatieId === locatie.id
                      )
                    )
                    .map(locatie => {
                      const productId = dranken.find(d => 
                        d.naam === geselecteerdeDrank.naam && 
                        d.locatieId === locatie.id
                      )?.id
                      
                      const telling = productId ? tellingen.find(t => 
                        t.drankId === productId && 
                        t.locatieId === locatie.id
                      ) : null
                      
                      return (
                        <div key={locatie.id} className="flex justify-between items-center">
                          <span className="text-sm">{locatie.naam}</span>
                          <span className="text-sm font-medium">{telling?.aantal || 0}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App 