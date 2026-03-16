export default function CalendrierLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
      <div className="h-10 bg-gray-100 rounded mb-4 animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
