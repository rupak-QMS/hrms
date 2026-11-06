'use client'

import {
  FileText, BarChart2, Users, Folder, AlertTriangle,
  CheckCircle, Bell, Lightbulb, Inbox, Search, Calendar,
  ClipboardList, type LucideIcon,
} from 'lucide-react'

/**
 * Consistent empty state for tables and lists.
 * Pass icon as a named key ('list', 'chart', 'users', etc.) or legacy emoji.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  list:      FileText,
  chart:     BarChart2,
  users:     Users,
  folder:    Folder,
  warning:   AlertTriangle,
  success:   CheckCircle,
  bell:      Bell,
  idea:      Lightbulb,
  inbox:     Inbox,
  search:    Search,
  calendar:  Calendar,
  clipboard: ClipboardList,
  '📋': FileText,
  '📊': BarChart2,
  '👤': Users,
  '📁': Folder,
  '⚠️': AlertTriangle,
  '✅': CheckCircle,
  '🔔': Bell,
  '💡': Lightbulb,
  '📭': Inbox,
  '🎉': CheckCircle,
  '📈': BarChart2,
  '📉': BarChart2,
  '🎯': ClipboardList,
  '🚀': ClipboardList,
  '💼': Folder,
  '🏢': Users,
  '❌': AlertTriangle,
}

type EmptyStateProps = {
  icon?: string
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  /** Use 'table' when rendering inside a <tbody> */
  as?: 'div' | 'table'
  cols?: number
}

export default function EmptyState({
  icon = 'inbox',
  title,
  message,
  action,
  as: variant = 'div',
  cols = 1,
}: EmptyStateProps) {
  const IconComponent = ICON_MAP[icon] ?? Inbox
  const content = (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-[#0E3D52]/[0.08] dark:bg-[#4ebac4]/10 flex items-center justify-center mb-4 ring-1 ring-[#0E3D52]/10 dark:ring-[#4ebac4]/15">
        <IconComponent className="w-6 h-6 text-[#1A6080] dark:text-[#4ebac4] opacity-70" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
      {message && (
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{message}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 btn-primary text-xs"
        >
          {action.label}
        </button>
      )}
    </div>
  )

  if (variant === 'table') {
    return (
      <tr>
        <td colSpan={cols} className="text-center">
          {content}
        </td>
      </tr>
    )
  }

  return content
}
