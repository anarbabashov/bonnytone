import AuthButtons from "@/components/layout/AuthButtons"

export default function Home() {
  return (
    <div>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              Auth
            </div>
            <AuthButtons />
          </div>
        </div>
      </header>

      {/* Main Content */}

    </div>
  )
}
