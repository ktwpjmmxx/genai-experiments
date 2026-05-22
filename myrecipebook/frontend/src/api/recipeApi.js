import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── レシピ CRUD ──────────────────────────────
export const fetchRecipes    = (params = {}) => api.get('/recipes', { params }).then(r => r.data)
export const fetchRecipe     = (id)          => api.get(`/recipes/${id}`).then(r => r.data)
export const createRecipe    = (data)        => api.post('/recipes', data).then(r => r.data)
export const updateRecipe    = (id, data)    => api.patch(`/recipes/${id}`, data).then(r => r.data)
export const deleteRecipe    = (id)          => api.delete(`/recipes/${id}`)
export const toggleFavorite  = (id)          => api.patch(`/recipes/${id}/favorite`).then(r => r.data)
export const fetchCategories = ()            => api.get('/categories').then(r => r.data)
export const askRecipeAI     = (id, question)=> api.post(`/recipes/${id}/ai-assist`, { question }).then(r => r.data)
export const suggestMenu     = (question)    => api.post('/ai/suggest-menu', { question }).then(r => r.data)

export const uploadImage = (id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/recipes/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

// ── Phase 1: AI発見・生成 ─────────────────────
/**
 * 気分・時間・カテゴリを元に料理候補を取得
 * @param {{ mood?: string, max_time?: number, category?: string }} params
 */
export const discoverRecipes = (params = {}) =>
  api.post('/ai/discover', params).then(r => r.data)

/**
 * 料理名からレシピ全文をAIが生成
 * @param {{ title: string, servings: number }} params
 */
export const generateRecipe = (params) =>
  api.post('/ai/generate-recipe', params).then(r => r.data)
