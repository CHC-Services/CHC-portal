'use client'

import PatientDocumentsPanel from '../PatientDocumentsPanel'

export default function PatientDocuments({
  patientId, basePath, canDeleteAny, uploaderId,
}: {
  patientId: string
  basePath: string
  canDeleteAny: boolean
  uploaderId?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <PatientDocumentsPanel
        patientId={patientId}
        basePath={basePath}
        canDeleteAny={canDeleteAny}
        uploaderId={uploaderId}
      />
    </div>
  )
}
