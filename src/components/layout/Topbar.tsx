'use client'

import { Bell, Search, ChevronDown } from 'lucide-react'

export default function Topbar() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 dark:bg-[#0F1E2E] dark:border-[#1A6080]/30">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 dark:text-gray-400" />
        <input
          type="search"
          placeholder="Search employees, documents…"
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:bg-[#0A1929] dark:border-[#1A6080]/30"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {/* Tenant selector */}
        <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:text-gray-400 dark:border-[#1A6080]/30">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          Yahweh Care
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Avatar */}
        <button className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold">
            SM
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
    </header>
  )
}
