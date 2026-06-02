import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage              from './pages/HomePage'
import LibraryPage           from './pages/LibraryPage'
import FavoritesPage         from './pages/FavoritesPage'
import RecipeDetailPage      from './pages/RecipeDetailPage'
import RecipeFormPage        from './pages/RecipeFormPage'
import DiscoverPage          from './pages/DiscoverPage'
import ShoppingListPage      from './pages/ShoppingListPage'
import SavedShoppingListPage from './pages/SavedShoppingListPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                        element={<Navigate to="/home" replace />} />
        <Route path="/home"                    element={<HomePage />} />
        <Route path="/library"                 element={<LibraryPage />} />
        <Route path="/favorites"               element={<FavoritesPage />} />
        <Route path="/discover"                element={<DiscoverPage />} />
        <Route path="/shopping"                element={<ShoppingListPage />} />
        <Route path="/shopping-lists/:id"      element={<SavedShoppingListPage />} />
        <Route path="/recipes/new"             element={<RecipeFormPage />} />
        <Route path="/recipes/:id"             element={<RecipeDetailPage />} />
        <Route path="/recipes/:id/edit"        element={<RecipeFormPage />} />
      </Routes>
    </BrowserRouter>
  )
}
