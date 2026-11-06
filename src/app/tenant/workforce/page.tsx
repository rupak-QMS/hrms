'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/ui/Skeleton'

type Summary = { totalActive:number; fullTime:number; partTime:number; casual:number; contractor:number; departments:number; positions:number }
type DeptRow  = { id:string; name:string; count:number; positions:number }
type Position = { id:string; title:string; departmentId:string|null; isActive:boolean }

export default function WorkforcePage() {
  const [summary, setSummary]   = useState<Summary | null>(null)
  const [depts, setDepts]       = useState<DeptRow[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchWithAuth('/api/tenant/workforce').then(r => r.json()).then(d => {
      setSummary(d.summary ?? null)
      setDepts(d.headcountByDepartment ?? [])
      setPositions(d.positions ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <SkeletonPage />

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Workforce Planning</h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Headcount overview, departments, and positions</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label:'Active Employees', value:summary.totalActive, cls:'text-[#0E3D52] dark:text-[#4ebac4]' },
              { label:'Full-time', value:summary.fullTime, cls:'text-gray-900' },
              { label:'Part-time', value:summary.partTime, cls:'text-gray-900' },
              { label:'Casual', value:summary.casual, cls:'text-gray-900' },
              { label:'Contractor', value:summary.contractor, cls:'text-gray-900' },
              { label:'Departments', value:summary.departments, cls:'text-gray-900' },
              { label:'Positions', value:summary.positions, cls:'text-gray-900' },
            ].map(s => (
              <div key={s.label} className="card-premium p-4">
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Headcount by department */}
        <div className="card-premium overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Headcount by Department</h2>
          </div>
          {depts.length === 0 ? (
            <p className="p-6 text-sm text-gray-600 dark:text-gray-400">No departments configured</p>
          ) : (
            <div className="table-responsive">
            <table className="table-premium">
              <thead><tr className="border-b border-gray-100 bg-gray-50 dark:bg-gray-800 dark:border-gray-800">
                <th>Department</th>
                <th>Active Staff</th>
                <th>Positions</th>
                <th>Vacancies</th>
              </tr></thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.id}>
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{d.name}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{d.count}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{d.positions}</td>
                    <td className="px-5 py-3">
                      {d.positions > d.count ? (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{d.positions - d.count} open</span>
                      ) : <span className="text-xs text-gray-600 dark:text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Positions */}
        <div className="card-premium overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">All Positions</h2>
          </div>
          {positions.length === 0 ? (
            <p className="p-6 text-sm text-gray-600 dark:text-gray-400">No positions defined</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
              {positions.map(p => (
                <div key={p.id} className="border border-gray-100 rounded-lg p-3 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{depts.find(d => d.id === p.departmentId)?.name ?? 'Unassigned'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
