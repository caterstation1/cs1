import { MainNav } from "@/components/MainNav"
import { TabbedLayout } from "@/components/TabbedLayout"

export default function ProductsPage() {
  return (
    <div className="min-h-screen">
      <MainNav />
      <main className="container mx-auto py-6">
        <TabbedLayout />
      </main>
    </div>
  )
} 