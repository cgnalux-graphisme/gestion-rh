export default function RapportsLoading() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-pulse">
      {/* En-tête */}
      <div className="h-8 bg-gray-200 rounded w-64" />
      {/* Filtres */}
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="h-8 bg-gray-200 rounded w-32" />
      </div>
      {/* Stats grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
        ))}
      </div>
      {/* Exports */}
      <div className="h-8 bg-gray-200 rounded w-32" />
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
