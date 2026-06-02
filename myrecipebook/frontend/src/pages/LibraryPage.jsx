import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchRecipes, fetchShoppingLists, deleteShoppingList } from '../api/recipeApi'
import RecipeCard from '../components/RecipeCard'
import BottomNav  from '../components/BottomNav'
import '../global.css'

const SORT_OPTIONS = [
  { key: 'date',  label: '追加日順' },
  { key: 'genre', label: 'ジャンル順' },
  { key: 'kana',  label: '五十音順' },
  { key: 'time',  label: '調理時間' },
]

function monthLabel(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function kanaGroup(title) {
  const c = title[0]
  const groups = [
    ['あ行', /^[あいうえおぁぃぅぇぉアイウエオァィゥェォa-zA-Z]/],
    ['か行', /^[かきくけこカキクケコ]/],
    ['さ行', /^[さしすせそサシスセソ]/],
    ['た行', /^[たちつてとタチツテト]/],
    ['な行', /^[なにぬねのナニヌネノ]/],
    ['は行', /^[はひふへほハヒフヘホ]/],
    ['ま行', /^[まみむめもマミムメモ]/],
    ['や行', /^[やゆよヤユヨ]/],
    ['ら行', /^[らりるれろラリルレロ]/],
    ['わ行', /^[わをんワヲン]/],
  ]
  for (const [label, re] of groups) if (re.test(c)) return label
  return 'その他'
}

function groupRecipes(recipes, sortKey) {
  if (sortKey === 'date') {
    const groups = {}
    recipes.forEach(r => {
      const key = monthLabel(r.created_at)
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups).map(([header, items]) => ({ header, items }))
  }
  if (sortKey === 'genre') {
    const groups = {}
    recipes.forEach(r => {
      if (!groups[r.category]) groups[r.category] = []
      groups[r.category].push(r)
    })
    return Object.entries(groups).map(([header, items]) => ({ header, items }))
  }
  if (sortKey === 'kana') {
    const groups = {}
    recipes.forEach(r => {
      const key = kanaGroup(r.title)
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups).map(([header, items]) => ({ header, items }))
  }
  if (sortKey === 'time') {
    const groups = { '〜15分':[], '16〜30分':[], '31〜60分':[], '60分以上':[] }
    recipes.forEach(r => {
      if      (r.cook_time <= 15)  groups['〜15分'].push(r)
      else if (r.cook_time <= 30)  groups['16〜30分'].push(r)
      else if (r.cook_time <= 60)  groups['31〜60分'].push(r)
      else                          groups['60分以上'].push(r)
    })
    return Object.entries(groups).filter(([,i]) => i.length > 0).map(([header, items]) => ({ header, items }))
  }
  return [{ header: '', items: recipes }]
}

// ── 買い物リスト一覧サブタブ ──────────────────
function ShoppingListsTab() {
  const navigate = useNavigate()
  const [lists,   setLists]   = useState([])
  const [loading, setLoading] = useState(true)
  const [delId,   setDelId]   = useState(null)

  useEffect(() => {
    fetchShoppingLists()
      .then(setLists)
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    await deleteShoppingList(id)
    setLists(prev => prev.filter(l => l.id !== id))
    setDelId(null)
  }

  const fmtDate = (str) => {
    const d = new Date(str)
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  if (loading) return <div className="spinner">読み込み中…</div>

  if (lists.length === 0) return (
    <div style={{ textAlign:'center',padding:'4rem 2rem' }}>
      <div style={{
        width:60,height:60,borderRadius:'50%',background:'var(--gold-light)',
        display:'flex',alignItems:'center',justifyContent:'center',
        margin:'0 auto 12px',fontSize:28,
      }}>🛒</div>
      <p style={{ fontSize:15,fontWeight:600,marginBottom:6 }}>保存済みの買い物リストはありません</p>
      <p style={{ fontSize:13,color:'var(--text-3)',lineHeight:1.7 }}>
        レシピ詳細 → 「🛒 買い物リスト」から<br />リストを作成して保存できます
      </p>
    </div>
  )

  return (
    <div style={{ padding:'14px 16px' }}>
      {lists.map(list => {
        const needItems = (list.items || []).filter(i => !i.is_text && i.needed > 0)
        const doneCount = (list.items || []).filter(i => i.checked).length
        const total     = (list.items || []).length

        return (
          <div key={list.id} style={{
            background:'var(--surface)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-md)',padding:'14px 16px',marginBottom:10,
          }}>
            {/* ヘッダー行 */}
            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8 }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:15,fontWeight:600,marginBottom:3 }}>
                  {list.recipe_title}
                </div>
                <div style={{ fontSize:12,color:'var(--text-3)',display:'flex',gap:10 }}>
                  <span>👥 {list.servings}人前</span>
                  <span>🕐 {fmtDate(list.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => setDelId(list.id)}
                style={{
                  background:'#fef2f2',border:'1px solid #fecaca',color:'#b91c1c',
                  borderRadius:'var(--radius-sm)',padding:'4px 10px',
                  fontSize:12,cursor:'pointer',flexShrink:0,marginLeft:8,
                }}
              >🗑 削除</button>
            </div>

            {/* 進捗バー */}
            <div style={{ marginBottom:8 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                <div style={{ flex:1,height:4,background:'#E5E7EB',borderRadius:999,overflow:'hidden' }}>
                  <div style={{
                    height:'100%',background:doneCount===total?'#3B6D11':'var(--blue)',
                    borderRadius:999,width:`${total>0?(doneCount/total)*100:0}%`,
                    transition:'width .3s ease',
                  }} />
                </div>
                <span style={{ fontSize:11,color:'var(--text-3)',flexShrink:0 }}>
                  {doneCount}/{total} 完了
                </span>
              </div>
            </div>

            {/* 購入が必要な材料プレビュー（最大3件） */}
            {needItems.length > 0 && (
              <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginBottom:8 }}>
                {needItems.slice(0,3).map((item,i) => (
                  <span key={i} style={{
                    fontSize:11,background:'var(--blue-light)',color:'var(--blue)',
                    padding:'2px 8px',borderRadius:4,
                  }}>
                    {item.name} {item.needed}{item.unit}
                  </span>
                ))}
                {needItems.length > 3 && (
                  <span style={{ fontSize:11,color:'var(--text-3)',padding:'2px 4px' }}>
                    他{needItems.length-3}件
                  </span>
                )}
              </div>
            )}

            {/* 詳細ボタン */}
            <button
              onClick={() => navigate(`/shopping-lists/${list.id}`)}
              style={{
                width:'100%',padding:'8px 0',
                background:'var(--bg)',border:'1px solid var(--border)',
                borderRadius:'var(--radius-sm)',fontSize:13,fontWeight:600,
                color:'var(--blue)',cursor:'pointer',
              }}
            >
              買い物リストを開く →
            </button>
          </div>
        )
      })}

      {/* 削除確認ダイアログ */}
      {delId && (
        <div style={{
          position:'fixed',inset:0,background:'rgba(0,0,0,.45)',
          display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:300,padding:20,
        }}>
          <div style={{
            background:'var(--surface)',borderRadius:'var(--radius-lg)',
            padding:24,maxWidth:300,width:'100%',
          }}>
            <p style={{ fontWeight:600,marginBottom:8 }}>この買い物リストを削除しますか？</p>
            <p style={{ fontSize:13,color:'var(--text-3)',marginBottom:20 }}>
              この操作は取り消せません。
            </p>
            <div style={{ display:'flex',gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setDelId(null)}>
                キャンセル
              </button>
              <button className="btn btn-danger" style={{ flex:1 }} onClick={() => handleDelete(delId)}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── メイン ────────────────────────────────────
export default function LibraryPage() {
  const navigate = useNavigate()
  const [mainTab,  setMainTab]  = useState('recipes')   // 'recipes' | 'shopping'
  const [recipes,  setRecipes]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sortKey,  setSortKey]  = useState('date')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    fetchRecipes({ sort:'created_at', order:'desc' })
      .then(setRecipes)
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = (updated) => {
    setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  const sorted = useMemo(() => {
    let list = [...recipes]
    if (search.trim()) list = list.filter(r => r.title.includes(search.trim()))
    if (sortKey === 'date')  list.sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
    if (sortKey === 'genre') list.sort((a,b) => a.category.localeCompare(b.category,'ja'))
    if (sortKey === 'kana')  list.sort((a,b) => a.title.localeCompare(b.title,'ja'))
    if (sortKey === 'time')  list.sort((a,b) => a.cook_time-b.cook_time)
    return list
  }, [recipes, sortKey, search])

  const groups = useMemo(() => groupRecipes(sorted, sortKey), [sorted, sortKey])

  return (
    <div className="page-wrapper">
      {/* ── ヘッダー ── */}
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <div className="topbar-title">ライブラリ</div>
            <div className="topbar-sub">
              {mainTab === 'recipes'
                ? `${recipes.length} レシピ保存中`
                : '保存済みの買い物リスト'}
            </div>
          </div>
        </div>
        {/* 検索バー（レシピタブのみ） */}
        {mainTab === 'recipes' && (
          <div className="topbar-search">
            <i className="ti ti-search" aria-hidden="true" />
            <input
              placeholder="レシピを検索…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                background:'none',border:'none',cursor:'pointer',
                color:'rgba(255,255,255,.7)',fontSize:16,padding:0,
              }}>✕</button>
            )}
          </div>
        )}
      </div>

      {/* ── メインタブ（レシピ ｜ 買い物リスト） ── */}
      <div style={{
        display:'flex',background:'var(--surface)',
        borderBottom:'1px solid var(--border)',
      }}>
        {[
          { key:'recipes',  label:'📚 レシピ' },
          { key:'shopping', label:'🛒 買い物リスト' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)} style={{
            flex:1,padding:'11px 0',fontSize:13,fontWeight:600,
            background:'none',border:'none',cursor:'pointer',
            color:mainTab===tab.key?'var(--blue)':'var(--text-3)',
            borderBottom:mainTab===tab.key?'2px solid var(--blue)':'2px solid transparent',
            transition:'all var(--t)',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── レシピタブ ── */}
      {mainTab === 'recipes' && (
        <>
          {/* ソートタブ */}
          <div style={{
            display:'flex',gap:6,padding:'10px 16px',
            overflowX:'auto',scrollbarWidth:'none',
            borderBottom:'1px solid var(--border)',background:'var(--surface)',
          }}>
            {SORT_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setSortKey(opt.key)} style={{
                flexShrink:0,padding:'6px 14px',borderRadius:999,fontSize:13,border:'1px solid',
                borderColor:sortKey===opt.key?'var(--blue)':'var(--border)',
                background: sortKey===opt.key?'var(--blue)':'var(--surface)',
                color:      sortKey===opt.key?'#fff':'var(--text-2)',
                cursor:'pointer',transition:'all var(--t)',
              }}>{opt.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="spinner">読み込み中…</div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign:'center',padding:'4rem 2rem' }}>
              <div style={{
                width:60,height:60,borderRadius:'50%',background:'var(--gold-light)',
                display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',
              }}>
                <span style={{ fontSize:28 }}>🍳</span>
              </div>
              <p style={{ fontSize:15,fontWeight:600 }}>
                {search ? `「${search}」のレシピは見つかりませんでした` : 'レシピがまだありません'}
              </p>
              <p style={{ fontSize:13,color:'var(--text-3)',marginTop:6,lineHeight:1.7 }}>
                右下の ＋ ボタンからレシピを追加できます
              </p>
            </div>
          ) : (
            <div style={{ paddingBottom:8 }}>
              {groups.map(({ header, items }) => (
                <div key={header}>
                  {header && (
                    <div style={{
                      padding:'10px 16px 5px',fontSize:12,fontWeight:600,
                      color:'var(--text-3)',letterSpacing:'.05em',
                      background:'var(--bg)',borderBottom:'1px solid var(--border)',
                    }}>{header}</div>
                  )}
                  <div style={{ display:'flex',flexDirection:'column',gap:8,padding:'10px 16px 2px' }}>
                    {items.map(r => (
                      <RecipeCard key={r.id} recipe={r} onUpdate={handleUpdate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 買い物リストタブ ── */}
      {mainTab === 'shopping' && <ShoppingListsTab />}

      <BottomNav />
    </div>
  )
}
