import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Terminal } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import { apiFetch } from "../api/apiClient"

import { motion } from "framer-motion"

export default function Maintenance() {
  const { data: windows } = useQuery({ queryKey: ["maintenance"], queryFn: async () => (await (await apiFetch("/api/v1/maintenance/")).json()) })
  const columnDefs = [
    { field: "title", headerName: "Title", flex: 1, cellClass: 'text-center', headerClass: 'text-center' }, 
    { field: "status", headerName: "Status", width: 150, cellClass: 'text-center', headerClass: 'text-center' }
  ]
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col space-y-4">
      <h1 className="text-2xl font-black uppercase italic">CP</h1>
      <div className="flex-1 glass-panel rounded-2xl overflow-hidden ag-theme-alpine-dark">
        <AgGridReact rowData={windows || []} columnDefs={columnDefs} />
      </div>
      <style>{`
        .ag-theme-alpine-dark {
          --ag-background-color: transparent;
          --ag-header-background-color: rgba(15, 23, 42, 0.9);
          --ag-border-color: rgba(255, 255, 255, 0.05);
          --ag-foreground-color: #f1f5f9;
          --ag-header-foreground-color: #94a3b8;
          --ag-font-family: 'Inter', sans-serif;
          --ag-font-size: 10px;
        }
        .ag-root-wrapper { border: none !important; }
        .ag-header-cell-label { font-weight: 900 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; font-size: 9px !important; justify-content: center !important; }
        .ag-cell { display: flex; align-items: center; justify-content: center !important; padding-left: 8px !important; }
      `}</style>
    </motion.div>
  )
}
